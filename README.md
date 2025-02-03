# 🌟 **OpenChat: Your Decentralized Chat Solution** 🌟  

🔗 **[Visit OpenChat](https://oc.app)**  

OpenChat is a fully-featured chat platform, running **end-to-end on the Internet Computer blockchain**. 🌐 Experience secure, scalable, and decentralized communication like never before. 🚀  

---

## **Prerequisites 🛠️**  

### 1️⃣ **DFX 0.23.0**  
Install using:  
```bash  
DFX_VERSION=0.23.0 sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"  
```  

### 2️⃣ **Rust**  
Install with a single command:  
```bash  
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh  
```  

### 3️⃣ **NPM**  
Download Node.js from: [Node.js Official Website](https://nodejs.org/en/download)  

---

## **Testing Locally 🚀**  

1️⃣ **Start DFX**  
```bash  
dfx start  
```  

2️⃣ **Deploy All Canisters (OpenChat + NNS)**  
```bash  
./scripts/deploy-local.sh  
```  

3️⃣ **Run the Frontend Website**  
```bash  
npm --prefix frontend run dev  
```  

4️⃣ **Upgrade Canisters (Example)**  
```bash  
./scripts/upgrade-canister-local.sh <DFX_IDENTITY_NAME> <CANISTER_NAME> <VERSION>  
# Example: ./scripts/upgrade-canister-local.sh default user 1.0.0  
```  

5️⃣ **Fresh Start (Optional)**  
- Stop DFX.  
- Remove all previous configurations:  
  ```bash  
  rm -rf .dfx  
  ```  
- Start again from step 1.  

---

## **Deterministic Builds 🔒**  

Ensure **verifiable and secure builds**:  
- Build the OpenChat canister WASMs:  
  ```bash  
  ./scripts/docker-build-all-wasms.sh  
  ```  
- Verify by comparing local WASM hashes with those exposed on the Internet Computer.  

---

## **License 📜**  

© 2024 OpenChat Labs LTD  
Licensed under **[AGPLv3](https://www.gnu.org/licenses/agpl-3.0.html)**  

---

💡 *Our tests run **fast** and **efficiently** with [RunsOn](https://runs-on.com).*  
