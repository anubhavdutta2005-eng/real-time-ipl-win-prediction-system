# Real-Time IPL Win Probability Prediction System

An end-to-end Machine Learning powered IPL match win probability prediction system built using XGBoost, FastAPI, React, and Tailwind CSS.

This project predicts live win probabilities during IPL matches based on real-time match conditions such as score, wickets, overs, target, teams, and venue.

# Features

- Real-time IPL win probability prediction
- XGBoost machine learning model
- FastAPI backend API integration
- Interactive React dashboard
- Dynamic probability visualization
- Match analytics cards
- Live scenario simulation engine
- Responsive modern UI
- Frontend-backend real-time communication

# Tech Stack

## Frontend
- React.js
- Vite
- Tailwind CSS
- JavaScript

## Backend
- FastAPI
- Uvicorn
- Python

## Machine Learning
- XGBoost
- Scikit-learn
- Pandas
- NumPy
- 
# Machine Learning Workflow

The ML model predicts the probability of the chasing team winning based on live match parameters.

## Input Features
- Batting Team
- Bowling Team
- Stadium/Venue
- Target Score
- Current Runs
- Wickets Fallen
- Overs Completed

## Derived Features
- Runs Left
- Balls Left
- Current Run Rate
- Required Run Rate
- Wickets Remaining

The trained XGBoost classifier generates real-time win probabilities using these engineered features.

# System Architecture

Frontend (React Dashboard)
↓
FastAPI Backend API
↓
Feature Engineering
↓
XGBoost Prediction Pipeline
↓
Probability Response
↓
Frontend Visualization

# Interactive Scenario Simulator

The dashboard includes a What-If Simulation Engine.

Users can simulate:
- Dot Ball
- Four (+4)
- Six (+6)
- Wicket

The frontend dynamically modifies match state and sends updated parameters to the backend prediction API, allowing real-time probability recalculation.

# Project Type

 Machine Learning Application

# Author

Anubhav Dutta
