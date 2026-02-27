#!/usr/bin/env bash
# Build script for Render deployment
pip install -r requirements.txt
cd backend && python seed.py
