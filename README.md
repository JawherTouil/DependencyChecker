Here’s an improved and professional version of your `README.md` — it’s clearer, better formatted, and easier to scan:

---

# 🧩 Dependency Checker

**A powerful CLI tool to analyze and optimize your Node.js dependencies.**
Easily detect unused, missing, outdated, and duplicate dependencies, scan for security vulnerabilities, and apply automated fixes to keep your project healthy and efficient.

---

## ✨ Features

* 🔍 **Unused Dependencies** – Identify packages in `package.json` that are not used in your codebase.
* ❓ **Missing Dependencies** – Detect imports or requires that aren’t listed in `package.json`.
* ⬆️ **Outdated Dependencies** – Find packages that can be updated to newer versions.
* 🔐 **Security Vulnerabilities** – Scan for known issues using `npm audit`.
* 🧬 **Duplicate Packages** – Highlight multiple versions of the same dependency.
* 📊 **Health Score** – Calculate an overall dependency health score (0–100).
* 🛠️ **Automated Fixes** – Apply safe fixes: remove unused, update outdated, deduplicate, and patch vulnerabilities.

---

## 📦 Installation

### Global (recommended)

```bash
npm install -g dependency-checker
```

### Local (dev dependency)

```bash
npm install --save-dev dependency-checker
```

---

## 🚀 Usage

Run commands from the root of your project (where `package.json` exists).

### 🔍 Summary

```bash
dependency-checker summary
```

Output in JSON format:

```bash
dependency-checker summary --json
```

### 🛠 Fix Issues

```bash
dependency-checker fix --outdated --yes
```

Available fix options:

* `--unused` – Remove unused packages
* `--outdated` – Update outdated packages
* `--vulnerabilities` – Fix known vulnerabilities
* `--duplicates` – Deduplicate packages
* `--all` – Apply all fixes
* `--force` – Force removal of protected packages
* `-y, --yes` – Skip confirmation prompts

### 📦 Unused Dependencies

```bash
dependency-checker unused
```

### ⬆️ Outdated Packages

```bash
dependency-checker outdated
```

### 📈 Health Score

```bash
dependency-checker score
```

---

## 🧪 Example Workflow

### Step 1 – Check your project

```bash
dependency-checker summary
```

**Example Output:**

```
📊 Comprehensive Dependency Analysis

🚀 Project: my-project v1.0.0
Dependencies: 4 prod / 2 dev
Scripts: 3 npm scripts
Node engines: ⚪ Not specified

🔍 Unused Dependencies: ✅ All good  
🔗 Missing Dependencies: ✅ All installed  
📦 Outdated: ❌ chalk: 4.1.2 → 5.4.1  
🔒 Vulnerabilities: ✅ None  
🔁 Duplicates: ✅ None  

💡 Suggestions:
• Run "dependency-checker fix --outdated" to update
• Run "dependency-checker fix --all" to fix everything
```

### Step 2 – Apply fixes

```bash
dependency-checker fix --outdated --yes
```

### Step 3 – Re-check

```bash
dependency-checker summary
```

---

## 📌 Notes

* **Chalk Version** – Uses `chalk@4.1.2` for CommonJS compatibility. `chalk@5.x` is ES Module-only and not currently supported.
* **Protected Packages** – Critical packages (e.g., `react`, `eslint`, `typescript`) are protected from removal unless `--force` is used.
* **Requirements** – Node.js v14 or higher. Must be run in a directory with a valid `package.json`.

---

## 🤝 Contributing

Contributions are welcome!
Feel free to open an issue or submit a PR on the [GitHub repository](https://github.com/your-username/dependency-checker).

---

## 📄 License

Licensed under the [MIT License] 

---

Would you like me to generate a Markdown file version or auto-push it to GitHub if your repo is linked?
