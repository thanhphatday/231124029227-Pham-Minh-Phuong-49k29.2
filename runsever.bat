@echo off
cd /d "%~dp0"
echo Mo trinh duyet tai: http://localhost:8080/index.html
start "" http://localhost:8080/index.html
python -m http.server 8080

