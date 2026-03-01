#!/usr/bin/env bash
echo "Starting Gunicorn on port ${PORT:-10000}..."
cd backend
gunicorn app:app --bind 0.0.0.0:${PORT:-10000}
