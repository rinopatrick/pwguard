#!/bin/bash
# Start Password Strength Visualizer (backend + frontend)
cd "$(dirname "$0")"

echo "Starting Password Visualizer backend on :8001..."
cd backend && uvicorn main:app --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!
cd ..

echo "Starting Password Visualizer frontend on :5173..."
cd frontend && npx vite --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!
cd ..

echo ""
echo "=== Password Strength Visualizer ==="
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8001"
echo "  Press Ctrl+C to stop"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
