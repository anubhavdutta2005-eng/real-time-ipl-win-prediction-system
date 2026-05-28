import pickle
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Initialize FastAPI app
app = FastAPI(
    title="IPL Win Predictor API",
    description="Serving XGBoost Win Prediction model for IPL chases",
    version="1.0.0"
)

# Enable CORS for React dev server and general cross-origin access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the trained XGBoost model pipeline
try:
    with open("pipe.pkl", "rb") as f:
        model_data = pickle.load(f)
        # Check structure: it should contain a "pipeline" key
        if isinstance(model_data, dict) and "pipeline" in model_data:
            pipe = model_data["pipeline"]
        else:
            # Fallback if pickle contains just the pipeline object
            pipe = model_data
    print("[OK] Model pipeline successfully loaded from pipe.pkl")
except Exception as e:
    print(f"[ERROR] Error loading model pipeline: {e}")
    pipe = None

# Active 8 core teams available in model
TEAMS = [
    "Sunrisers Hyderabad",
    "Mumbai Indians",
    "Kolkata Knight Riders",
    "Chennai Super Kings",
    "Delhi Capitals",
    "Kings XI Punjab",
    "Royal Challengers Bangalore",
    "Rajasthan Royals"
]

# Unique venues seen by model during training
VENUES = [
    "Arun Jaitley Stadium",
    "Arun Jaitley Stadium, Delhi",
    "Barabati Stadium",
    "Barsapara Cricket Stadium, Guwahati",
    "Brabourne Stadium",
    "Brabourne Stadium, Mumbai",
    "Buffalo Park",
    "De Beers Diamond Oval",
    "Dr DY Patil Sports Academy",
    "Dr DY Patil Sports Academy, Mumbai",
    "Dr. Y.S. Rajasekhara Reddy ACA-VDCA Cricket Stadium",
    "Dr. Y.S. Rajasekhara Reddy ACA-VDCA Cricket Stadium, Visakhapatnam",
    "Dubai International Cricket Stadium",
    "Eden Gardens",
    "Eden Gardens, Kolkata",
    "Feroz Shah Kotla",
    "Himachal Pradesh Cricket Association Stadium",
    "Holkar Cricket Stadium",
    "JSCA International Stadium Complex",
    "Kingsmead",
    "M Chinnaswamy Stadium",
    "M Chinnaswamy Stadium, Bengaluru",
    "M.Chinnaswamy Stadium",
    "MA Chidambaram Stadium",
    "MA Chidambaram Stadium, Chepauk",
    "MA Chidambaram Stadium, Chepauk, Chennai",
    "Maharashtra Cricket Association Stadium",
    "Maharashtra Cricket Association Stadium, Pune",
    "Narendra Modi Stadium, Ahmedabad",
    "New Wanderers Stadium",
    "Newlands",
    "OUTsurance Oval",
    "Punjab Cricket Association IS Bindra Stadium",
    "Punjab Cricket Association IS Bindra Stadium, Mohali",
    "Punjab Cricket Association Stadium, Mohali",
    "Rajiv Gandhi International Stadium",
    "Rajiv Gandhi International Stadium, Uppal",
    "Rajiv Gandhi International Stadium, Uppal, Hyderabad",
    "Sardar Patel Stadium, Motera",
    "Sawai Mansingh Stadium",
    "Sawai Mansingh Stadium, Jaipur",
    "Shaheed Veer Narayan Singh International Stadium",
    "Sharjah Cricket Stadium",
    "Sheikh Zayed Stadium",
    "St George's Park",
    "Subrata Roy Sahara Stadium",
    "SuperSport Park",
    "Vidarbha Cricket Association Stadium, Jamtha",
    "Wankhede Stadium",
    "Wankhede Stadium, Mumbai",
    "Zayed Cricket Stadium, Abu Dhabi"
]

class PredictRequest(BaseModel):
    batting_team: str
    bowling_team: str
    venue: str
    target: int = Field(..., gt=0, description="Target score to chase (1st innings score + 1)")
    current_score: int = Field(..., ge=0, description="Current score of batting team")
    wickets_fallen: int = Field(..., ge=0, le=9, description="Number of wickets out (0 to 9)")
    overs_completed: int = Field(..., ge=0, le=19, description="Overs completed (0 to 19)")
    balls_bowled_in_over: int = Field(..., ge=0, le=5, description="Balls bowled in current over (0 to 5)")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "IPL Win Predictor API is operational.",
        "model_loaded": pipe is not None
    }

@app.get("/api/meta")
def get_metadata():
    return {
        "teams": TEAMS,
        "venues": sorted(VENUES)
    }

@app.post("/api/predict")
def predict(req: PredictRequest):
    if pipe is None:
        raise HTTPException(
            status_code=500,
            detail="Machine learning model is not loaded. Check server logs."
        )

    # Validate inputs
    if req.batting_team not in TEAMS:
        raise HTTPException(status_code=400, detail=f"Invalid batting team: '{req.batting_team}'")
    if req.bowling_team not in TEAMS:
        raise HTTPException(status_code=400, detail=f"Invalid bowling team: '{req.bowling_team}'")
    if req.venue not in VENUES:
        raise HTTPException(status_code=400, detail=f"Invalid venue: '{req.venue}'")
    if req.batting_team == req.bowling_team:
        raise HTTPException(status_code=400, detail="Batting and bowling teams must be different.")
    if req.current_score >= req.target:
        raise HTTPException(status_code=400, detail="Current score cannot be greater than or equal to target.")

    # Calculate model input features
    runs_left = req.target - req.current_score
    wickets_left = 10 - req.wickets_fallen
    
    # ML Formula for balls_left: 120 - (over * 6 + ball)
    # where over is 1-indexed (overs_completed + 1) and ball is balls in current over
    over = req.overs_completed + 1
    ball = req.balls_bowled_in_over
    balls_left = 120 - (over * 6 + ball)
    
    # Clip and bound balls_left safely to prevent division by zero or negative balls
    if balls_left <= 0:
        balls_left = 1
    
    balls_bowled = 120 - balls_left
    
    # Current Run Rate (CRR): score / (overs completed)
    if balls_bowled > 0:
        curr_run_rate = (req.current_score * 6) / balls_bowled
    else:
        curr_run_rate = 0.0

    # Required Run Rate (RRR): runs left / (overs left)
    req_run_rate = (runs_left * 6) / balls_left

    # Construct dataframe with EXACT features in the correct order:
    # ['match_id', 'batting_team', 'bowling_team', 'venue', 'runs_left', 'balls_left', 'wickets_left', 'curr_run_rate', 'req_run_rate']
    features_df = pd.DataFrame([{
        "match_id": 1, # dummy value required for matching column length
        "batting_team": req.batting_team,
        "bowling_team": req.bowling_team,
        "venue": req.venue,
        "runs_left": runs_left,
        "balls_left": balls_left,
        "wickets_left": wickets_left,
        "curr_run_rate": curr_run_rate,
        "req_run_rate": req_run_rate
    }])

    try:
        # Run prediction pipeline
        probabilities = pipe.predict_proba(features_df)[0]
        
        # XGBoost output shape: [prob_class_0, prob_class_1]
        # Class 0: Batting team loses (bowling team wins)
        # Class 1: Batting team wins
        batting_win_prob = float(probabilities[1])
        bowling_win_prob = float(probabilities[0])

        return {
            "batting_team": req.batting_team,
            "bowling_team": req.bowling_team,
            "batting_win_percentage": round(batting_win_prob * 100, 2),
            "bowling_win_percentage": round(bowling_win_prob * 100, 2),
            "calculated_features": {
                "runs_left": runs_left,
                "balls_left": balls_left,
                "wickets_left": wickets_left,
                "curr_run_rate": round(curr_run_rate, 2),
                "req_run_rate": round(req_run_rate, 2)
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error executing model pipeline prediction: {str(e)}"
        )
