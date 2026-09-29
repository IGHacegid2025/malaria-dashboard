#!/bin/bash
# Runs the admin smoke test against the test database (reset it first with sql/setup_test_database.ps1).
# Author: Khadim Gueye

source ~/miniconda3/etc/profile.d/conda.sh
conda activate malaria_dashboard
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [ -z "$DB_HOST" ] && grep -qi microsoft /proc/version; then
  export DB_HOST="$(ip route | awk '/default/ {print $3; exit}')"
fi
export DB_NAME=malaria_dashboard_test
python tests/smoke_admin.py
