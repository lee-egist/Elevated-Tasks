# **Elevated Tasks \- Architecture & Deployment Guide**

This document outlines the "Engine & Shell" architecture used to deploy the Elevated Tasks Add-on. This setup ensures that the core logic and Intellectual Property (IP) remain in a personal Google Workspace, while the employer's Workspace acts only as a "Thin Client" to render the Add-on.

## **🏗️ 1\. The Architecture Model**

The application is split into two distinct parts:

### **A. The "Engine" (Your Personal Account)**

* **What it is:** The actual codebase. It contains all the HTML, CSS, JavaScript logic, API calls, and the eslint configuration.  
* **Where it lives:** Your personal Google Drive.  
* **How it updates:** Managed entirely by GitHub Actions CI/CD.

### **B. The "Shell" (Your Employer's Account)**

* **What it is:** A tiny, static Apps Script file that acts as a bridge. It contains almost no logic.  
* **Where it lives:** Your employer's Google Workspace.  
* **How it works:** It imports your "Engine" as a Google Apps Script **Library** and simply forwards user clicks to your personal script.

## **🗺️ 2\. The Four-Project Layout**

To safely manage testing and production, there are exactly **four** Apps Script projects in existence.

### **In Your Personal Account (The Engines)**

1. **Engine Dev:** \* **Target:** GitHub develop branch pushes here automatically.  
   * **Purpose:** Your sandbox. You use this to test code before making it live.  
2. **Engine Prod:**  
   * **Target:** GitHub main branch pushes here automatically.  
   * **Purpose:** The stable, live codebase.

### **In Your Employer's Account (The Shells)**

3. **Shell Dev:** \* **Code:** Just bridge functions calling ElevatorEngine.\[functionName\]().  
   * **Library Linked:** Linked to **Engine Dev** using the HEAD (Development) version.  
   * **Purpose:** Installed only on your work email for live testing with real company data.  
4. **Shell Prod:** \* **Code:** Identical to Shell Dev.  
   * **Library Linked:** Linked to **Engine Prod** using a specific version number (e.g., Version 24).  
   * **Purpose:** Published to the rest of the company.

## **🚀 3\. The Feature Deployment Workflow**

When you want to add a new feature (like a new button or a bug fix), here is the exact sequence of events you follow:

### **Step 1: Code & Dev Push**

1. Write the code locally on your machine.  
2. Run npx eslint src/ to check for errors.  
3. Commit and push to the develop branch.  
   * *GitHub Action triggers \-\> Pushes code to **Engine Dev**.*

### **Step 2: Live Dev Testing**

1. Open your work email and open the **Shell Dev** Add-on.  
2. Because it is linked to the HEAD version of Engine Dev, your new feature appears instantly.  
3. Test it to ensure it works properly with the employer's Workspace data.

### **Step 3: Production Release**

1. Merge develop into main and push to GitHub.  
   * *GitHub Action triggers \-\> Pushes code to **Engine Prod** AND creates a new Google Deployment Version.*  
2. Take note of the new version number (e.g., if it was V24, it is now V25).

### **Step 4: Update the Company**

1. Log into your Employer Workspace and open the **Shell Prod** script.  
2. Go to the **Libraries** tab on the left.  
3. Click on the ElevatorEngine library and change the Version from V24 to V25.  
4. Click Save.  
   * *The entire company now has the updated feature.*

## **⚙️ 4\. Manifest (appsscript.json) Differences**

Because the Engine and the Shell do different jobs, their manifests look slightly different.

### **Engine Manifest (Personal Account)**

* **Web App Setup:** Must have "executeAs": "USER\_ACCESSING". This ensures that when the HTML is rendered, it runs as the user viewing the sidebar, not as you.  
* **Advanced Services:** Must have Tasks, People, and AdminDirectory explicitly enabled in the JSON dependencies.

### **Shell Manifest (Employer Account)**

* **Scopes:** Must contain the exact same oauthScopes array as the Engine. If a scope is missing here, the Engine will be blocked from using it.  
* **Advanced Services:** Does **not** need the advanced services block.  
* **Web App:** Does **not** need the webapp block.

## **🛑 Troubleshooting**

* **"Function XYZ is not defined" in the Add-on:** You forgot to add a "bridge" function in the Shell script to forward the call to the Engine.  
* **"You do not have permission to perform this action":** Check if the scopes in the Employer's appsscript.json match the scopes in the Personal appsscript.json exactly.  
* **Data looks like my personal data, not company data:** Ensure the Engine's appsscript.json has executeAs set to USER\_ACCESSING, not USER\_DEPLOYING.