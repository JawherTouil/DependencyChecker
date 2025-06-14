Dependency Checker

A powerful CLI tool to analyze and optimize Node.js project dependencies. It helps you identify unused, missing, outdated, and duplicate dependencies, as well as security vulnerabilities, and provides automated fixes to keep your project healthy.

Features





Unused Dependencies: Detects dependencies not used in your codebase.



Missing Dependencies: Identifies required dependencies not listed in package.json.



Outdated Dependencies: Checks for outdated packages and suggests updates.



Security Vulnerabilities: Scans for known vulnerabilities using npm audit.



Duplicate Packages: Finds duplicate package versions in your dependency tree.



Health Score: Calculates a dependency health score based on identified issues.



Automated Fixes: Provides commands to remove unused dependencies, update outdated packages, fix vulnerabilities, and deduplicate packages.

Installation

Install dependency-checker globally to use it in any project:

npm install -g dependency-checker

Or install it locally as a development dependency in your project:

npm install --save-dev dependency-checker

Usage

Run dependency-checker commands from the root of your Node.js project (where package.json is located).

Commands





summary: Displays a comprehensive analysis of your project's dependencies.

dependency-checker summary

Use the --json flag to output results in JSON format:

dependency-checker summary --json



fix: Automatically fixes dependency issues. Specify what to fix or use --all.

dependency-checker fix --outdated --yes

Options:





--unused: Remove unused dependencies.



--outdated: Update outdated dependencies.



--vulnerabilities: Fix security vulnerabilities.



--duplicates: Deduplicate packages.



--all: Fix all issues.



--force: Remove protected packages (use with caution).



-y, --yes: Skip confirmation prompts.



unused: Checks for unused dependencies.

dependency-checker unused



outdated: Checks for outdated dependencies.

dependency-checker outdated



score: Calculates a dependency health score (0-100).

dependency-checker score

Example Workflow





Check the status of your dependencies:

dependency-checker summary

Output example:

📊 Comprehensive Dependency Analysis

🚀 Project Overview:
  Name: my-project v1.0.0
  Dependencies: 4 production + 2 development
  Scripts: 3 npm scripts
  Node engines: ⚪ Not specified

🔍 Unused Dependencies:
  ✅ All dependencies are being used

🔗 Missing Dependencies:
  ✅ All required dependencies are installed

📦 Outdated Dependencies:
  ❌ 1 outdated packages
    chalk: 4.1.2 → 5.4.1

🔒 Security Vulnerabilities:
  ✅ No known security vulnerabilities

🔄 Package Duplicates:
  ✅ No duplicate package versions

💡 Quick Fix Suggestions:
  • Run "dependency-checker fix --outdated" to update packages

🚀 Run "dependency-checker fix --all" to fix all issues automatically!



Fix outdated dependencies:

dependency-checker fix --outdated --yes



Verify the fixes:

dependency-checker summary

Notes





Chalk Version: This tool uses chalk@4.1.2 for CommonJS compatibility. Upgrading to chalk@5.x is not supported due to its ES Module format.



Protected Packages: Certain critical packages (e.g., react, typescript, eslint) are protected from removal to prevent accidental breaking changes. Use the --force flag to override (at your own risk).



Requirements: Node.js v14 or higher is recommended. Ensure you have a package.json file in your project directory.

Contributing

Contributions are welcome! Please open an issue or submit a pull request on the GitHub repository.

License

This project is licensed under the ISC License. See the LICENSE file for details.