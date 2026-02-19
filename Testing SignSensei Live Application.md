Testing a real-time multimodal application like **SignSensei Live** is unique because you aren't just testing buttons and text; you are testing **vision accuracy, audio latency, and system orchestration.**

To win the hackathon, your testing plan should cover three distinct "vitals": **Performance (Latency)**, **Multimodal Accuracy (ASL Recognition)**, and **Resilience (Session Stability).**

## ---

**1\. Multimodal Accuracy Testing (The "ASL Lab")**

Since the judges won't necessarily be ASL experts, your testing must prove that Gemini "sees" and "understands" correctly.

* **Ground Truth Validation:** Create a "Gold Set" of 10-20 video clips of yourself signing the same words (e.g., "Hello", "Prateek") in different lighting and backgrounds. Use these to verify that Gemini’s feedback remains consistent.  
* **Confusion Matrix:** Test signs that look similar (e.g., the letters "A", "S", and "T" in fingerspelling). If Gemini gets confused, refine your **System Instructions** to be more specific: *"For the letter 'A', the thumb must unmistakably be on the side of the fist, not tucked in"*.  
* **Barge-in Testing:** Intentionally interrupt the AI while it is speaking. Ensure the interrupted: true signal is received and that your React app immediately flushes the audio buffer so the AI doesn't "talk over" you.

## **2\. Latency & Performance Testing**

The "Live" factor is 30% of your score. You need to measure the **Time-to-First-Token (TTFT)**.

* **Network Throttling:** Use Chrome DevTools to simulate "Fast 3G" or "Slow 4G." Ensure your **Smart Framerate** logic successfully drops to 1-5 FPS during these conditions so the WebSocket doesn't lag or crash.  
* **Latency Decomposition:** Measure how long it takes from the moment you finish a sign to the moment Gemini fires the log\_correct\_sign tool call. For a "flawless" feel, aim for under **500ms**.  
* **Resampling Check:** Verify that your React app is correctly downsampling your microphone from 44.1kHz to **16kHz 16-bit PCM** before sending, as incorrect formats are a leading cause of session errors.

## **3\. Resilience & Edge Cases**

* **The "Clean Slate" Test:** What happens if you walk out of the camera frame? Test if Gemini handles "No User Detected" gracefully (e.g., *"I've lost sight of you\! Come back so we can continue"*).  
* **Token Exhaustion Simulation:** Run a session for 10+ minutes. Verify that the slidingWindow compression is working and that the app doesn't crash once the 131,072 token limit is reached.  
* **Function Calling Loop:** Use a "Mock" mode in your frontend to test your tool calls (toggle\_3d\_avatar, finish\_lesson) without burning through your real API quota during UI development.

### ---

**A Sample "Testing Table" for your Text Description**

| Test Case | Method | Expected Result |
| :---- | :---- | :---- |
| **Rapid Fingerspelling** | 15 FPS Video Stream | Gemini correctly identifies P-R-A-T-E-E-K. |
| **Voice Interruption** | User speaks during AI feedback | AI stops audio immediately; listens for user. |
| **Poor Lighting** | Dimmed room environment | Gemini requests the user to move to a brighter spot. |
| **Non-Blocking Tool** | log\_correct\_sign call | UI updates XP bar; AI speech continues smoothly. |

### **The "Winning" Bonus: Automated Cloud Testing**

For those **Bonus Points**, include a simple **GitHub Action** that runs a "Smoke Test" on your backend. It should check if the /api/auth/token endpoint returns a valid ephemeral token. This proves to the judges that your code is **production-ready and reproducible.**

**Would you like me to generate a "Test Plan" document you can include in your GitHub repository for the judges?**

The Gemini Multimodal Live API Tutorial provides a deep dive into setting up real-time streaming and tool calls, which are the foundations you will be testing.