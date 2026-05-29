import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Trophy, 
  MapPin, 
  Percent, 
  TrendingUp, 
  ShieldAlert, 
  Users, 
  Zap, 
  Flame, 
  Play, 
  RotateCcw, 
  Info,
  Sliders,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

const API_BASE_URL = "https://anubhav-10-real-time-ipl-win-prediction-system.hf.space";

const TEAM_THEMES = {
  "Sunrisers Hyderabad": { bg: "from-orange-600 to-yellow-500", text: "text-orange-400", border: "border-orange-500/30", color: "#F97316", lightBg: "bg-orange-950/20" },
  "Mumbai Indians": { bg: "from-blue-700 to-blue-500", text: "text-blue-400", border: "border-blue-500/30", color: "#3B82F6", lightBg: "bg-blue-950/20" },
  "Kolkata Knight Riders": { bg: "from-purple-800 to-indigo-700", text: "text-purple-400", border: "border-purple-500/30", color: "#A855F7", lightBg: "bg-purple-950/20" },
  "Chennai Super Kings": { bg: "from-yellow-500 to-yellow-300", text: "text-yellow-400", border: "border-yellow-400/30", color: "#EAB308", lightBg: "bg-yellow-950/10" },
  "Delhi Capitals": { bg: "from-blue-600 to-red-600", text: "text-cyan-400", border: "border-cyan-500/30", color: "#06B6D4", lightBg: "bg-cyan-950/20" },
  "Kings XI Punjab": { bg: "from-red-700 to-red-500", text: "text-red-400", border: "border-red-500/30", color: "#EF4444", lightBg: "bg-red-950/20" },
  "Royal Challengers Bangalore": { bg: "from-red-800 to-neutral-800", text: "text-rose-500", border: "border-rose-600/30", color: "#F43F5E", lightBg: "bg-rose-950/20" },
  "Rajasthan Royals": { bg: "from-pink-600 to-blue-600", text: "text-pink-400", border: "border-pink-500/30", color: "#EC4899", lightBg: "bg-pink-950/20" }
};

const DEFAULT_THEME = { bg: "from-emerald-600 to-teal-500", text: "text-emerald-400", border: "border-emerald-500/30", color: "#10B981", lightBg: "bg-emerald-950/20" };

function App() {
  // Metadata states
  const [teams, setTeams] = useState([]);
  const [venues, setVenues] = useState([]);
  
  // Input form states
  const [battingTeam, setBattingTeam] = useState('Mumbai Indians');
  const [bowlingTeam, setBowlingTeam] = useState('Chennai Super Kings');
  const [venue, setVenue] = useState('Wankhede Stadium');
  const [target, setTarget] = useState(180);
  const [currentScore, setCurrentScore] = useState(120);
  const [wicketsFallen, setWicketsFallen] = useState(3);
  const [oversCompleted, setOversCompleted] = useState(12);
  const [ballsBowledInOver, setBallsBowledInOver] = useState(0);

  // Connection & API states
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('connecting'); // online, offline, connecting
  const [prediction, setPrediction] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Interactive scenario shifts
  const [prevProbability, setPrevProbability] = useState(null);
  const [swingType, setSwingType] = useState(null); // 'wicket', 'six', 'boundary', 'dot', null
  const [swingAmount, setSwingAmount] = useState(0);

  // Fetch meta on mount
  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      setBackendStatus('connecting');
      const response = await axios.get(`${API_BASE_URL}/api/meta`);
      setTeams(response.data.teams);
      setVenues(response.data.venues);
      
      // Setup initial defaults from response if available
      if (response.data.teams.length > 0) {
        setBattingTeam(response.data.teams[1] || response.data.teams[0]);
        setBowlingTeam(response.data.teams[3] || response.data.teams[0]);
      }
      if (response.data.venues.length > 0) {
        // Fallback or select typical venue
        const defaultVenue = response.data.venues.find(v => v.includes('Wankhede')) || response.data.venues[0];
        setVenue(defaultVenue);
      }
      setBackendStatus('online');
    } catch (error) {
      console.error("Failed fetching metadata from API:", error);
      setBackendStatus('offline');
      // Load fallback local values so UI works as mock in extreme fallback cases
      setTeams(Object.keys(TEAM_THEMES));
      setVenues(["Wankhede Stadium", "Eden Gardens", "M Chinnaswamy Stadium", "MA Chidambaram Stadium", "Arun Jaitley Stadium"]);
    }
  };

  // Intermediate Live Calculations
  const runsLeft = Math.max(0, target - currentScore);
  const wicketsLeft = Math.max(0, 10 - wicketsFallen);
  
  // ML balls left formula
  const overNumber = oversCompleted + 1;
  const rawBallsLeft = 120 - (overNumber * 6 + ballsBowledInOver);
  const ballsLeft = Math.max(1, Math.min(120, rawBallsLeft));
  const ballsBowled = 120 - ballsLeft;
  
  const crr = ballsBowled > 0 ? ((currentScore * 6) / ballsBowled) : 0;
  const rrr = ballsLeft > 0 ? ((runsLeft * 6) / ballsLeft) : 0;

  // Retrieve current active team themes
  const battingTheme = TEAM_THEMES[battingTeam] || DEFAULT_THEME;
  const bowlingTheme = TEAM_THEMES[bowlingTeam] || DEFAULT_THEME;

  // API Call for Predictions
  const predictWinOdds = async (customState = null) => {
    const payload = customState || {
      batting_team: battingTeam,
      bowling_team: bowlingTeam,
      venue: venue,
      target: parseInt(target),
      current_score: parseInt(currentScore),
      wickets_fallen: parseInt(wicketsFallen),
      overs_completed: parseInt(oversCompleted),
      balls_bowled_in_over: parseInt(ballsBowledInOver)
    };

    if (payload.batting_team === payload.bowling_team) {
      setErrorMsg("Batting team and Bowling team must be different.");
      return;
    }
    if (payload.current_score >= payload.target) {
      setErrorMsg("Chasing team has already crossed or reached the target score!");
      return;
    }
    
    setErrorMsg('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/predict`, payload);
      
      // Track shifts for the scenario simulator animations
      if (prediction) {
        const diff = response.data.batting_win_percentage - prediction.batting_win_percentage;
        setSwingAmount(diff);
      } else {
        setSwingAmount(0);
      }
      
      setPrediction(response.data);
      setBackendStatus('online');
    } catch (error) {
      console.error("Prediction API failed:", error);
      setErrorMsg(error.response?.data?.detail || "Could not retrieve live prediction. Ensure the FastAPI backend is running.");
      setBackendStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  // Run initial prediction when metadata loads
  useEffect(() => {
    if (backendStatus === 'online') {
      predictWinOdds();
    }
  }, [backendStatus]);

  // Scenario Simulator quick trigger
  const runScenarioSimulation = async (type) => {
    setSwingType(type);
    
    let nextScore = currentScore;
    let nextWickets = wicketsFallen;
    let nextOvers = oversCompleted;
    let nextBalls = ballsBowledInOver + 1;

    // Handle over rollover (maximum 6 balls in an over)
    if (nextBalls >= 6) {
      nextBalls = 0;
      nextOvers = Math.min(19, nextOvers + 1);
    }

    if (type === 'dot') {
      // No run added, 1 ball bowled
    } else if (type === 'boundary') {
      nextScore = Math.min(target - 1, nextScore + 4);
    } else if (type === 'six') {
      nextScore = Math.min(target - 1, nextScore + 6);
    } else if (type === 'wicket') {
      nextWickets = Math.min(9, nextWickets + 1);
    }

    const payload = {
      batting_team: battingTeam,
      bowling_team: bowlingTeam,
      venue: venue,
      target: parseInt(target),
      current_score: parseInt(nextScore),
      wickets_fallen: parseInt(nextWickets),
      overs_completed: parseInt(nextOvers),
      balls_bowled_in_over: parseInt(nextBalls)
    };

    // Store previous probability before updating
    if (prediction) {
      setPrevProbability(prediction.batting_win_percentage);
    }

    // Update frontend state immediately to reflect simulator values
    setCurrentScore(nextScore);
    setWicketsFallen(nextWickets);
    setOversCompleted(nextOvers);
    setBallsBowledInOver(nextBalls);

    // Call predictor with new state
    await predictWinOdds(payload);

    // Clear animations after 3 seconds
    setTimeout(() => {
      setSwingType(null);
    }, 3000);
  };

  const resetCalculator = () => {
    setCurrentScore(120);
    setTarget(180);
    setWicketsFallen(3);
    setOversCompleted(12);
    setBallsBowledInOver(0);
    setPrediction(null);
    setPrevProbability(null);
    setSwingType(null);
    setErrorMsg('');
    predictWinOdds({
      batting_team: battingTeam,
      bowling_team: bowlingTeam,
      venue: venue,
      target: 180,
      current_score: 120,
      wickets_fallen: 3,
      overs_completed: 12,
      balls_bowled_in_over: 0
    });
  };

  // Swap Teams
  const handleSwapTeams = () => {
    const temp = battingTeam;
    setBattingTeam(bowlingTeam);
    setBowlingTeam(temp);
  };

  // Feature Importance Stats for XGBoost
  const FEATURE_IMPORTANCES = [
    { name: 'Wickets Left', weight: 29.84, color: 'bg-emerald-500', icon: Users },
    { name: 'Required Run Rate (RRR)', weight: 28.53, color: 'bg-purple-500', icon: TrendingUp },
    { name: 'Current Run Rate (CRR)', weight: 21.05, color: 'bg-blue-500', icon: Flame },
    { name: 'Balls Remaining', weight: 10.74, color: 'bg-yellow-500', icon: Zap },
    { name: 'Runs Needed', weight: 9.84, color: 'bg-rose-500', icon: Sliders }
  ];

  return (
    <div className="min-h-screen bg-[#0B0A1A] relative text-slate-100 flex flex-col font-sans overflow-x-hidden selection:bg-emerald-500 selection:text-black">
      
      {/* Background Ambience Stadium Lights */}
      <div className="stadium-glow top-12 left-[-150px]"></div>
      <div className="stadium-glow-purple bottom-12 right-[-150px]"></div>

      {/* Modern Header / Navigation */}
      <header className="w-full py-4 px-6 md:px-12 border-b border-white/5 bg-[#0f0e24]/80 backdrop-blur-md sticky top-0 z-40 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-tr from-emerald-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Trophy className="h-6 w-6 text-emerald-300 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
              CREASE<span className="text-emerald-400">CAST</span>
            </h1>
            <p className="text-xs text-slate-500">Live IPL Win Probability Analytics Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 text-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${
              backendStatus === 'online' ? 'bg-emerald-500 animate-ping' : 
              backendStatus === 'offline' ? 'bg-rose-500' : 'bg-yellow-500 animate-pulse'
            }`}></span>
            <span className={`h-2.5 w-2.5 rounded-full absolute ${
              backendStatus === 'online' ? 'bg-emerald-500' : 
              backendStatus === 'offline' ? 'bg-rose-500' : 'bg-yellow-500'
            }`}></span>
            <span className="text-slate-400 ml-1">
              Backend: {backendStatus === 'online' ? 'Online' : backendStatus === 'offline' ? 'Offline' : 'Connecting...'}
            </span>
          </div>

          <button 
            onClick={fetchMetadata}
            className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full hover:bg-emerald-500/20 transition-all font-medium"
          >
            Reconnect API
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Side: Parameters / Configuration (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col gap-5 shadow-2xl">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-500 to-emerald-700"></div>
            
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                <Sliders className="h-5 w-5 text-emerald-400" />
                Match Parameters
              </h2>
              <button 
                onClick={resetCalculator}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-all"
                title="Reset states to default values"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>

            {/* Team Selection Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
              
              {/* Batting Team Dropdown */}
              <div className="sm:col-span-5 flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Chasing / Batting
                </label>
                <select 
                  value={battingTeam} 
                  onChange={(e) => {
                    setBattingTeam(e.target.value);
                    if (e.target.value === bowlingTeam) {
                      // Swap to avoid conflict
                      const remaining = teams.find(t => t !== e.target.value);
                      if (remaining) setBowlingTeam(remaining);
                    }
                  }}
                  className="w-full glass-input px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                >
                  {teams.map((team) => (
                    <option key={team} value={team} className="bg-[#0f0e24] text-slate-200">
                      {team}
                    </option>
                  ))}
                </select>
              </div>

              {/* VS Swap Button */}
              <div className="sm:col-span-1 flex justify-center pt-4">
                <button
                  onClick={handleSwapTeams}
                  className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-slate-300"
                  title="Swap Teams"
                >
                  ⇄
                </button>
              </div>

              {/* Bowling Team Dropdown */}
              <div className="sm:col-span-5 flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  Bowling / Defending
                </label>
                <select 
                  value={bowlingTeam} 
                  onChange={(e) => {
                    setBowlingTeam(e.target.value);
                    if (e.target.value === battingTeam) {
                      const remaining = teams.find(t => t !== e.target.value);
                      if (remaining) setBattingTeam(remaining);
                    }
                  }}
                  className="w-full glass-input px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                >
                  {teams.map((team) => (
                    <option key={team} value={team} className="bg-[#0f0e24] text-slate-200">
                      {team}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Venue Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                Stadium / Venue
              </label>
              <select 
                value={venue} 
                onChange={(e) => setVenue(e.target.value)}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
              >
                {venues.map((v) => (
                  <option key={v} value={v} className="bg-[#0f0e24] text-slate-200">
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Numeric Input Sliders Section */}
            <div className="flex flex-col gap-4">
              
              {/* Target & Score Grid */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Target Score Input */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Target Score</span>
                    <span className="text-white font-bold">{target} runs</span>
                  </div>
                  <input 
                    type="range" 
                    min="50" 
                    max="300" 
                    value={target}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setTarget(val);
                      if (currentScore >= val) {
                        setCurrentScore(val - 1);
                      }
                    }}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <input 
                    type="number"
                    min="50"
                    max="300"
                    value={target}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 0);
                      setTarget(val);
                      if (currentScore >= val) {
                        setCurrentScore(val - 1);
                      }
                    }}
                    className="glass-input text-center text-xs py-1 px-2 rounded-lg w-full"
                  />
                </div>

                {/* Current Score Input */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Current Runs</span>
                    <span className="text-emerald-400 font-bold">{currentScore} runs</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max={target - 1} 
                    value={currentScore}
                    onChange={(e) => setCurrentScore(parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <input 
                    type="number"
                    min="0"
                    max={target - 1}
                    value={currentScore}
                    onChange={(e) => setCurrentScore(Math.min(target - 1, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="glass-input text-center text-xs py-1 px-2 rounded-lg w-full"
                  />
                </div>

              </div>

              {/* Wickets & Overs Grid */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Wickets Fallen Input */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Wickets Fallen</span>
                    <span className="text-rose-400 font-bold">{wicketsFallen} / 10</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="9" 
                    value={wicketsFallen}
                    onChange={(e) => setWicketsFallen(parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="grid grid-cols-5 gap-1">
                    {[0, 2, 4, 6, 8].map((num) => (
                      <button
                        key={num}
                        onClick={() => setWicketsFallen(num)}
                        className={`text-[10px] py-0.5 border rounded transition-all ${
                          wicketsFallen === num 
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 font-bold' 
                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Overs Completed Input */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Overs Completed</span>
                    <span className="text-white font-bold">{oversCompleted}.{ballsBowledInOver} overs</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="19" 
                    value={oversCompleted}
                    onChange={(e) => setOversCompleted(parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  
                  {/* Ball Selection Row */}
                  <div className="flex justify-between items-center gap-1">
                    {[0, 1, 2, 3, 4, 5].map((ballNum) => (
                      <button
                        key={ballNum}
                        onClick={() => setBallsBowledInOver(ballNum)}
                        className={`flex-1 text-[10px] py-0.5 border rounded text-center transition-all ${
                          ballsBowledInOver === ballNum 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 font-bold' 
                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                        title={`${ballNum} balls bowled in this over`}
                      >
                        .{ballNum}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

            </div>

            {/* Error Message alert */}
            {errorMsg && (
              <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-xl p-3 flex items-start gap-2 text-xs">
                <ShieldAlert className="h-4.5 w-4.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Trigger Button */}
            <button
              onClick={() => predictWinOdds()}
              disabled={loading || battingTeam === bowlingTeam || currentScore >= target}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 tracking-wide shadow-xl active:scale-98 transition-all bg-gradient-to-r ${battingTheme.bg} hover:brightness-110 disabled:opacity-50`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Calculating Live Probabilities...
                </>
              ) : (
                <>
                  <Play className="h-4.5 w-4.5 fill-black" />
                  PREDICT WIN ODDS
                </>
              )}
            </button>

          </div>

          {/* Quick Scenario Simulator Card (NEW) */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-500 to-indigo-600"></div>
            
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                <Zap className="h-4.5 w-4.5 text-purple-400" />
                Live Scenario What-If Simulator
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Test how the next delivery shifts the match win probability:</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => runScenarioSimulation('dot')}
                disabled={loading || currentScore >= target}
                className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/20 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-slate-200"
              >
                🔴 Dot Ball
              </button>
              
              <button
                onClick={() => runScenarioSimulation('wicket')}
                disabled={loading || wicketsFallen >= 9 || currentScore >= target}
                className="bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-rose-300"
              >
                ☝ Wicket
              </button>

              <button
                onClick={() => runScenarioSimulation('boundary')}
                disabled={loading || currentScore >= target}
                className="bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-emerald-300"
              >
                🏏 Four (+4)
              </button>

              <button
                onClick={() => runScenarioSimulation('six')}
                disabled={loading || currentScore >= target}
                className="bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/20 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-purple-300"
              >
                🚀 Six (+6)
              </button>
            </div>

            {/* Swing Flasher Alert */}
            {swingType && swingAmount !== 0 && (
              <div className={`text-center py-2 px-3 rounded-xl text-xs font-semibold animate-bounce shadow-md flex items-center justify-center gap-1.5 ${
                swingAmount > 0 
                  ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-400' 
                  : 'bg-rose-950/40 border border-rose-500/30 text-rose-400'
              }`}>
                <span>{swingType === 'wicket' ? '☝ Wicket!' : swingType === 'six' ? '🚀 Massive Six!' : swingType === 'boundary' ? '🏏 Boundary!' : '🔴 Dot Ball.'}</span>
                <span>Odds swing: {swingAmount > 0 ? '+' : ''}{swingAmount.toFixed(2)}% to {battingTeam}</span>
              </div>
            )}

          </div>
        </section>

        {/* Right Side: Visualizations, Odds, Gauges (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Main Prediction & Odds Display Container */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-6 shadow-2xl relative">
            <h2 className="text-lg font-bold flex items-center gap-2 text-white">
              <Percent className="h-5 w-5 text-emerald-400 animate-pulse" />
              Live Prediction Dashboard
            </h2>

            {prediction ? (
              <div className="flex flex-col gap-8">
                
                {/* Visual Odds Battle Ring */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  
                  {/* Left Side: Dynamic Comparison Grid */}
                  <div className="flex flex-col gap-5">
                    
                    {/* Batting Team Odds Bar */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">{battingTeam} (Chasing)</span>
                        <span className={`text-base font-extrabold ${battingTheme.text} text-glow`}>
                          {prediction.batting_win_percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-950/60 rounded-full h-3.5 border border-white/5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full bg-gradient-to-r ${battingTheme.bg} transition-all duration-1000 ease-out`}
                          style={{ width: `${prediction.batting_win_percentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Versus indicator */}
                    <div className="flex items-center justify-center">
                      <span className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold tracking-widest text-slate-500">
                        VERSUS
                      </span>
                    </div>

                    {/* Bowling Team Odds Bar */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">{bowlingTeam} (Defending)</span>
                        <span className={`text-base font-extrabold ${bowlingTheme.text} text-glow`}>
                          {prediction.bowling_win_percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-950/60 rounded-full h-3.5 border border-white/5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full bg-gradient-to-r ${bowlingTheme.bg} transition-all duration-1000 ease-out`}
                          style={{ width: `${prediction.bowling_win_percentage}%` }}
                        ></div>
                      </div>
                    </div>

                  </div>

                  {/* Right Side: Circular Interactive Odds Ring */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative h-44 w-44 flex items-center justify-center">
                      {/* Outer Ring glow */}
                      <div className="absolute inset-0 rounded-full border border-white/5 animate-pulse-slow"></div>
                      
                      {/* Circle Gauge SVG */}
                      <svg className="w-full h-full transform -rotate-90">
                        <circle 
                          cx="88" 
                          cy="88" 
                          r="76" 
                          stroke="rgba(255, 255, 255, 0.05)" 
                          strokeWidth="8" 
                          fill="transparent" 
                        />
                        <circle 
                          cx="88" 
                          cy="88" 
                          r="76" 
                          stroke={battingTheme.color} 
                          strokeWidth="10" 
                          fill="transparent" 
                          strokeDasharray={2 * Math.PI * 76}
                          strokeDashoffset={2 * Math.PI * 76 * (1 - prediction.batting_win_percentage / 100)}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-out text-glow"
                        />
                      </svg>
                      
                      {/* Content inside ring */}
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-black tracking-tighter text-white">
                          {prediction.batting_win_percentage}%
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          {battingTeam.split(' ')[0]} Win
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Live Match Pitch Progress Visualizer (NEW) */}
                <div className="glass-panel-light p-4 rounded-xl border border-white/5 flex flex-col gap-3 relative overflow-hidden">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-emerald-400" />
                      Live Match Pitch Visualizer
                    </span>
                    <span className="text-slate-400">Target: {target} runs</span>
                  </div>

                  {/* A stylized green turf progress bar representing the run chase pitch */}
                  <div className="w-full h-8 bg-gradient-to-r from-emerald-950/80 to-emerald-900/60 rounded-xl relative border border-emerald-500/20 overflow-hidden flex items-center px-4">
                    {/* Chasing Team Score fill */}
                    <div 
                      className={`h-full bg-emerald-500/20 absolute left-0 top-0 transition-all duration-500`}
                      style={{ width: `${Math.min(100, (currentScore / target) * 100)}%` }}
                    ></div>

                    {/* Turf Markings */}
                    <div className="absolute left-[30%] top-0 w-px h-full bg-white/5"></div>
                    <div className="absolute left-[60%] top-0 w-px h-full bg-white/5"></div>
                    <div className="absolute left-[90%] top-0 w-px h-full bg-white/5"></div>

                    {/* Progress text overlay */}
                    <div className="relative z-10 w-full flex justify-between items-center text-[10px] font-bold tracking-wide">
                      <span className="text-emerald-400">{battingTeam}: {currentScore}/{wicketsFallen}</span>
                      <span className="text-white/60">Runs needed: {runsLeft} off {ballsLeft} balls</span>
                      <span className="text-emerald-300">{(currentScore / target * 100).toFixed(0)}% home</span>
                    </div>
                  </div>
                </div>

                {/* Analysis Message / Dynamic Commentary */}
                <div className={`p-4 rounded-xl text-xs leading-relaxed flex items-start gap-3 border ${
                  prediction.batting_win_percentage > 60 ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300' :
                  prediction.batting_win_percentage < 40 ? 'bg-rose-950/20 border-rose-500/20 text-rose-300' :
                  'bg-yellow-950/10 border-yellow-500/20 text-yellow-300'
                }`}>
                  <Info className="h-5 w-5 shrink-0 mt-0.5" />
                  <p>
                    {prediction.batting_win_percentage > 65 
                      ? `${battingTeam} is in absolute control of this match at this venue, needing ${runsLeft} runs off ${ballsLeft} deliveries. Wickets left (${wicketsLeft}) and a highly achievable RRR of ${prediction.calculated_features.req_run_rate} make them overwhelming favorites.`
                      : prediction.batting_win_percentage < 35
                      ? `${bowlingTeam} has built extreme pressure. The required run rate is currently ${prediction.calculated_features.req_run_rate} runs/over. With only ${wicketsLeft} wickets remaining, ${battingTeam} will need a historic, high-risk partnership to pull off this chase.`
                      : `A thrilling, highly competitive finish is brewing! The match hangs in the balance. With ${battingTeam} needing a solid CRR of ${prediction.calculated_features.curr_run_rate} and only ${wicketsLeft} wickets out, a couple of boundaries or a wicket in this over will swing the win percentages massively.`}
                  </p>
                </div>

              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-center gap-4 text-slate-500">
                <HelpCircle className="h-16 w-16 text-slate-700 animate-pulse" />
                <div>
                  <h3 className="text-white font-bold text-base">Predict Win Odds to Begin</h3>
                  <p className="text-xs max-w-sm mt-1">Configure the match parameters on the left and hit the Predict button to fetch real XGBoost probabilities.</p>
                </div>
              </div>
            )}

          </div>

          {/* Quick Metrics & Calculated Features (Intermediate Stats) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Metric Card: Runs needed */}
            <div className="glass-panel p-4 rounded-xl flex flex-col gap-1 border-l-4 border-l-emerald-500 shadow-lg">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Runs Needed</span>
              <span className="text-xl font-black text-white">{runsLeft}</span>
              <span className="text-[10px] text-slate-500">Target score is {target}</span>
            </div>

            {/* Metric Card: Balls Remaining */}
            <div className="glass-panel p-4 rounded-xl flex flex-col gap-1 border-l-4 border-l-yellow-500 shadow-lg">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Balls Left</span>
              <span className="text-xl font-black text-white">{ballsLeft}</span>
              <span className="text-[10px] text-slate-500">~{Math.floor(ballsLeft / 6)}.{ballsLeft % 6} overs left</span>
            </div>

            {/* Metric Card: Current Run Rate */}
            <div className="glass-panel p-4 rounded-xl flex flex-col gap-1 border-l-4 border-l-blue-500 shadow-lg">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Current Run Rate</span>
              <span className="text-xl font-black text-white">{crr.toFixed(2)}</span>
              <span className="text-[10px] text-slate-500">Score is {currentScore}/{wicketsFallen}</span>
            </div>

            {/* Metric Card: Required Run Rate */}
            <div className="glass-panel p-4 rounded-xl flex flex-col gap-1 border-l-4 border-l-rose-500 shadow-lg">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Req. Run Rate</span>
              <span className={`text-xl font-black ${rrr > crr + 2 ? 'text-rose-400' : 'text-white'}`}>
                {rrr.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500">Active pressure gauge</span>
            </div>

          </div>



        </section>

      </main>

      {/* Modern Compact Footer */}
      <footer className="py-6 px-12 border-t border-white/5 bg-[#080714] text-center text-xs text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-3 relative z-10">
        <p>© 2026 CreaseCast IPL Win Predictor. Designed for advanced live cricket analytics.</p>
        <p className="flex items-center gap-1.5 text-slate-500 font-medium">
          Powered by <b>XGBoost Classifier + FastAPI</b>
        </p>
      </footer>

    </div>
  );
}

export default App;
