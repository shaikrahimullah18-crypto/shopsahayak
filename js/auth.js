/* ==========================================================================
   ShopSahayak - Authentication & Face Verification Controller (Phase 2)
   Features:
   - Two-step login (Credentials -> Live biometric face verification)
   - Hardcoded demo credentials for Ravi Sharma (Owner)
   - MediaPipe Tasks Vision lazy loader with offline/blocked fallback
   - Standalone verifyFace(frame) approval rule
   - Strict MediaStream safety: camera lights off on exit
   - Session persistence via sessionStorage & topbar logout
   ========================================================================== */

// ============================================================================
// MARKED CONSTANT: Hardcoded Demo Credentials for Ravi Sharma (Owner)
// Swap this constant or connect to your backend API when ready.
// ============================================================================
const DEMO_AUTH_CREDENTIALS = {
  username: "ravi",
  password: "password123",
  user: {
    name: "Ravi Sharma",
    role: "owner",
    storeName: "Sharma Kirana Store"
  }
};

const SESSION_STORAGE_KEY = "shopsahayak_session";

/**
 * STANDALONE APPROVAL RULE FOR FACE VERIFICATION
 * Can later be replaced by a backend API call (e.g. POST /api/auth/verify-face).
 *
 * Approval criteria:
 * 1. Exactly one face detected
 * 2. Confidence >= 0.70
 * 3. Reasonably centered (face center within 35% radius of video center)
 * 4. Large enough in frame (face width >= 20% of video width)
 *
 * @param {Object} frame - Detection payload { detections, videoWidth, videoHeight, timestamp }
 * @returns {{ approved: boolean, statusKey: string, confidence: number }}
 */
function verifyFace(frame) {
  if (!frame || !frame.detections || frame.detections.length === 0) {
    return { approved: false, statusKey: "loginFaceLooking", confidence: 0 };
  }

  if (frame.detections.length > 1) {
    return { approved: false, statusKey: "loginFaceTooMany", confidence: 0 };
  }

  const detection = frame.detections[0];
  const confidence = (detection.categories && detection.categories[0]) ? detection.categories[0].score : 0;

  if (confidence < 0.70) {
    return { approved: false, statusKey: "loginFaceImproveLight", confidence };
  }

  const box = detection.boundingBox; // { originX, originY, width, height }
  if (!box || !frame.videoWidth || !frame.videoHeight) {
    return { approved: false, statusKey: "loginFaceLooking", confidence };
  }

  // Size check: face width relative to video width
  const faceRatio = box.width / frame.videoWidth;
  if (faceRatio < 0.20) {
    return { approved: false, statusKey: "loginFaceMoveCloser", confidence };
  }

  // Centering check: distance from center
  const faceCenterX = box.originX + box.width / 2;
  const faceCenterY = box.originY + box.height / 2;
  const videoCenterX = frame.videoWidth / 2;
  const videoCenterY = frame.videoHeight / 2;
  const dist = Math.hypot(faceCenterX - videoCenterX, faceCenterY - videoCenterY);
  const maxOffset = Math.min(frame.videoWidth, frame.videoHeight) * 0.35;

  if (dist > maxOffset) {
    return { approved: false, statusKey: "loginFaceHoldStill", confidence };
  }

  // All spatial and confidence rules passed
  return { approved: true, statusKey: "loginFaceHoldStill", confidence };
}

class ShopAuthManager {
  constructor() {
    this.currentStep = 1;
    this.isDetecting = false;
    this.detectionLoopId = null;
    this.faceDetector = null;
    this.faceDetectorLoading = false;
    this.faceDetectorFailed = false;
    this.steadyStartMs = null;
    this.scanStartMs = null;
    this.timeoutTimerId = null;
    this.STEADY_HOLD_DURATION_MS = 1500; // 1.5 seconds steady hold required
    this.SCAN_TIMEOUT_MS = 20000;         // 20s timeout for demo bypass offer
    this.activeUser = null;
  }

  /**
   * Initialize Auth UI on DOM load
   */
  init() {
    this._bindEvents();

    if (this.hasActiveSession()) {
      this.enterApp(false);
    } else {
      this.showLogin(1);
    }
  }

  /**
   * Check if a valid session exists in sessionStorage
   * @returns {boolean}
   */
  hasActiveSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed && parsed.user);
    } catch (e) {
      return false;
    }
  }

  /**
   * Save session to sessionStorage
   * @param {string} authMethod - 'credentials_and_face', 'demo_bypass', or 'registered_user'
   */
  _saveSession(authMethod) {
    try {
      const user = this.activeUser || DEMO_AUTH_CREDENTIALS.user;
      const sessionData = {
        user: user,
        authMethod: authMethod,
        timestamp: Date.now()
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      if (user && user.email) {
        localStorage.setItem("shopsahayak_user_email", user.email);
      }
    } catch (e) {
      // Ignore storage errors in restrictive modes
    }
  }

  /**
   * Show registration view
   */
  showRegister() {
    this._stopDetection();
    window.ShopCamera.stopCamera();

    const loginCard = document.querySelector(".login-card");
    const step1Sec = document.getElementById("loginStep1Section");
    const step2Sec = document.getElementById("loginStep2Section");
    const regSec = document.getElementById("registerSection");
    const stepsIndicator = document.querySelector(".login-steps-indicator");
    const regErr = document.getElementById("registerError");
    const regSuccess = document.getElementById("registerSuccess");

    if (loginCard) loginCard.classList.add("register-mode");
    if (stepsIndicator) stepsIndicator.style.display = "none";
    if (step1Sec) step1Sec.style.display = "none";
    if (step2Sec) step2Sec.classList.remove("active");
    if (regSec) regSec.style.display = "flex";
    if (regErr) regErr.style.display = "none";
    if (regSuccess) regSuccess.style.display = "none";
  }

  /**
   * Show login page at step 1 or 2
   * @param {number} step
   */
  showLogin(step = 1) {
    const loginContainer = document.getElementById("loginContainer");
    const appShell = document.getElementById("app");
    const loginCard = document.querySelector(".login-card");
    const regSec = document.getElementById("registerSection");
    const stepsIndicator = document.querySelector(".login-steps-indicator");

    if (loginContainer) loginContainer.style.display = "flex";
    if (appShell) appShell.style.display = "none";
    if (loginCard) loginCard.classList.remove("register-mode");
    if (regSec) regSec.style.display = "none";
    if (stepsIndicator) stepsIndicator.style.display = "flex";

    this.goToStep(step);
  }

  /**
   * Switch between Step 1 (Credentials) and Step 2 (Face Verification)
   * @param {number} step
   */
  goToStep(step) {
    this.currentStep = step;
    this.verificationToken = (this.verificationToken || 0) + 1;
    const step1Sec = document.getElementById("loginStep1Section");
    const step2Sec = document.getElementById("loginStep2Section");
    const step1Badge = document.getElementById("loginStepBadge1");
    const step2Badge = document.getElementById("loginStepBadge2");
    const credError = document.getElementById("loginCredError");

    if (credError) credError.style.display = "none";

    if (step === 1) {
      this._stopDetection();
      window.ShopCamera.stopCamera();

      if (step1Sec) step1Sec.style.display = "flex";
      if (step2Sec) step2Sec.classList.remove("active");

      if (step1Badge) {
        step1Badge.classList.add("active");
        step1Badge.classList.remove("completed");
      }
      if (step2Badge) {
        step2Badge.classList.remove("active", "completed");
      }
    } else if (step === 2) {
      if (step1Sec) step1Sec.style.display = "none";
      if (step2Sec) step2Sec.classList.add("active");

      if (step1Badge) {
        step1Badge.classList.remove("active");
        step1Badge.classList.add("completed");
      }
      if (step2Badge) {
        step2Badge.classList.add("active");
        step2Badge.classList.remove("completed");
      }

      this.startFaceVerification();
    }
  }

  /**
   * Handle Step 1 credentials form submission (Demo or MongoDB Registered User)
   */
  async handleCredentialsSubmit() {
    const usernameInput = document.getElementById("loginUsernameInput");
    const passwordInput = document.getElementById("loginPasswordInput");
    const credError = document.getElementById("loginCredError");
    const submitBtn = document.getElementById("loginSubmitBtn");

    const u = (usernameInput?.value || "").trim().toLowerCase();
    const p = passwordInput?.value || "";

    const isDemo = (u === DEMO_AUTH_CREDENTIALS.username || u === "ravi.sharma" || u === "owner") &&
                    p === DEMO_AUTH_CREDENTIALS.password;

    if (isDemo) {
      if (credError) credError.style.display = "none";
      this.activeUser = DEMO_AUTH_CREDENTIALS.user;
      this.goToStep(2);
      return;
    }

    // Check backend API for registered user
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Authenticating...";
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: u, password: p })
      });

      const data = await res.json();

      if (res.ok && data.success && data.user) {
        this.activeUser = data.user;
        if (data.token) {
          try { sessionStorage.setItem("shopsahayak_token", data.token); } catch (e) {}
        }
        if (window.shopStore && window.shopStore.initializeForUser) {
          window.shopStore.initializeForUser(data.user);
        }
        if (credError) credError.style.display = "none";
        this.goToStep(2);
        return;
      } else {
        if (credError) {
          credError.innerText = data.message || "Invalid credentials. Please check your email and password.";
          credError.style.display = "flex";
        }
      }
    } catch (err) {
      if (credError) {
        const lang = window.shopStore?.currentLanguage || document.documentElement.lang || "en";
        const dict = (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS[lang]) ? TRANSLATIONS[lang] : {};
        credError.innerText = dict.loginInvalidCreds || "Invalid username or password. Please use the demo credentials.";
        credError.style.display = "flex";
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        const lang = window.shopStore?.currentLanguage || document.documentElement.lang || "en";
        const dict = (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS[lang]) ? TRANSLATIONS[lang] : {};
        submitBtn.innerText = dict.loginNextBtn || "Continue to Face Verification →";
      }
    }
  }

  /**
   * Handle Store Registration form submission
   */
  async handleRegisterSubmit() {
    const ownerName = (document.getElementById("regOwnerName")?.value || "").trim();
    const storeName = (document.getElementById("regStoreName")?.value || "").trim();
    const email = (document.getElementById("regEmail")?.value || "").trim();
    const phone = (document.getElementById("regPhone")?.value || "").trim();
    const category = document.getElementById("regCategory")?.value || "Grocery & FMCG";
    const upi = (document.getElementById("regUpi")?.value || "").trim();
    const address = (document.getElementById("regAddress")?.value || "").trim();
    const gstin = (document.getElementById("regGstin")?.value || "").trim();
    const password = document.getElementById("regPassword")?.value || "";
    const confirmPassword = document.getElementById("regConfirmPassword")?.value || "";

    const regErr = document.getElementById("registerError");
    const regSuccess = document.getElementById("registerSuccess");
    const regSubmitBtn = document.getElementById("registerSubmitBtn");

    const lang = window.shopStore?.currentLanguage || document.documentElement.lang || "en";
    const dict = (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS[lang]) ? TRANSLATIONS[lang] : {};

    if (regErr) regErr.style.display = "none";
    if (regSuccess) regSuccess.style.display = "none";

    // Validations
    if (password !== confirmPassword) {
      if (regErr) {
        regErr.innerText = dict.regPasswordMismatch || "Passwords do not match. Please re-enter.";
        regErr.style.display = "flex";
      }
      return;
    }

    if (password.length < 6) {
      if (regErr) {
        regErr.innerText = dict.regPasswordTooShort || "Password must be at least 6 characters long.";
        regErr.style.display = "flex";
      }
      return;
    }

    try {
      if (regSubmitBtn) {
        regSubmitBtn.disabled = true;
        regSubmitBtn.innerText = "Registering store in MongoDB Atlas...";
      }

      const payload = {
        name: ownerName,
        storeName: storeName,
        email: email,
        phone: phone,
        storeCategory: category,
        upiId: upi,
        address: address,
        gstin: gstin,
        password: password,
        role: "owner"
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to register store. Please try again.");
      }

      // Registration successful!
      if (regSuccess) {
        let msgHtml = `
          <div style="font-weight: 700; margin-bottom: 4px; font-size: 13.5px;">🎉 Store Registered in MongoDB Atlas!</div>
          <div style="font-size: 12px; margin-bottom: 6px;">${dict.regSuccessMsg || "Account created successfully with dedicated MongoDB Atlas tables."}</div>
        `;

        if (data.tableCreated) {
          msgHtml += `
            <div style="font-size: 11.5px; margin-bottom: 4px; background: rgba(255,255,255,0.06); padding: 4px 8px; border-radius: 4px;">
              📦 <strong>Dedicated Table Created:</strong> <code style="color: #6ee7b7;">${data.tableCreated}</code>
            </div>
          `;
        }

        if (data.sms && data.sms.phone) {
          msgHtml += `
            <div style="font-size: 11.5px; margin-bottom: 6px; background: rgba(255,255,255,0.06); padding: 4px 8px; border-radius: 4px;">
              📱 <strong>Welcome Message:</strong> Dispatched to <strong style="color: #93c5fd;">${data.sms.phone}</strong>
            </div>
          `;
          if (data.sms.whatsappUrl) {
            msgHtml += `
              <div style="margin-top: 6px; display: flex; gap: 8px; align-items: center;">
                <a href="${data.sms.whatsappUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; background: #25D366; color: #ffffff; text-decoration: none; border-radius: 6px; padding: 6px 12px; font-weight: 600; font-size: 12px; transition: opacity 0.2s;">
                  📲 Open Welcome on WhatsApp
                </a>
                <button type="button" id="regContinueAppBtn" style="background: var(--color-primary, #6366f1); color: #fff; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer;">
                  Enter Dashboard →
                </button>
              </div>
            `;
          }
        }

        regSuccess.innerHTML = msgHtml;
        regSuccess.style.display = "flex";
        regSuccess.style.flexDirection = "column";

        const contBtn = document.getElementById("regContinueAppBtn");
        if (contBtn) {
          contBtn.addEventListener("click", () => {
            this.enterApp(true);
          });
        }
      }

      this.activeUser = data.user;
      if (data.token) {
        try { sessionStorage.setItem("shopsahayak_token", data.token); } catch (e) {}
      }

      // Initialize state store specifically for this registered user
      if (window.shopStore && window.shopStore.initializeForUser) {
        window.shopStore.initializeForUser(data.user);
      }

      // Automatically persist session and transition into application
      this._saveSession("registered_user");
      setTimeout(() => {
        this.enterApp(true);
      }, 3500);

    } catch (error) {
      if (regErr) {
        regErr.innerText = error.message || "An error occurred during registration. Please try again.";
        regErr.style.display = "flex";
      }
    } finally {
      if (regSubmitBtn) {
        regSubmitBtn.disabled = false;
        regSubmitBtn.innerText = dict.registerSubmitBtn || "Register Store & Launch ShopSahayak ✦";
      }
    }
  }

  /**
   * Auto-fill demo credentials
   */
  autoFillDemo() {
    const usernameInput = document.getElementById("loginUsernameInput");
    const passwordInput = document.getElementById("loginPasswordInput");
    const credError = document.getElementById("loginCredError");

    if (usernameInput) usernameInput.value = DEMO_AUTH_CREDENTIALS.username;
    if (passwordInput) passwordInput.value = DEMO_AUTH_CREDENTIALS.password;
    if (credError) credError.style.display = "none";

    // Visual feedback
    [usernameInput, passwordInput].forEach(el => {
      if (el) {
        el.style.backgroundColor = "rgba(99, 102, 241, 0.1)";
        setTimeout(() => { el.style.backgroundColor = ""; }, 400);
      }
    });
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility() {
    const pwInput = document.getElementById("loginPasswordInput");
    const pwBtn = document.getElementById("loginPwToggleBtn");
    if (!pwInput || !pwBtn) return;

    const isPw = pwInput.type === "password";
    pwInput.type = isPw ? "text" : "password";

    const lang = window.shopStore?.currentLanguage || document.documentElement.lang || "en";
    const dict = (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS[lang]) ? TRANSLATIONS[lang] : {};
    pwBtn.setAttribute("aria-label", isPw ? (dict.loginHidePassword || "Hide password") : (dict.loginShowPassword || "Show password"));
    pwBtn.title = isPw ? (dict.loginHidePassword || "Hide password") : (dict.loginShowPassword || "Show password");
  }

  /**
   * Step 2: Start face verification
   */
  async startFaceVerification() {
    this._stopDetection();
    this.steadyStartMs = null;
    this.scanStartMs = Date.now();
    this.verificationToken = (this.verificationToken || 0) + 1;
    const currentToken = this.verificationToken;

    const videoEl = document.getElementById("loginFaceVideo");
    const containerEl = document.getElementById("faceViewfinder");
    const statusTextEl = document.getElementById("faceStatusText");
    const errContainer = document.getElementById("loginFaceErrContainer");
    const skipBtn = document.getElementById("faceSkipDemoBtn");
    const lang = window.shopStore?.currentLanguage || document.documentElement.lang || "en";
    const dict = (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS[lang]) ? TRANSLATIONS[lang] : {};

    if (errContainer) window.ShopCamera.clearError(errContainer);
    if (containerEl) containerEl.classList.remove("verified");
    if (statusTextEl) statusTextEl.innerText = dict.loginFaceLooking || "Looking for a face...";

    // Set 20s timeout to prominently offer demo skip
    if (this.timeoutTimerId) clearTimeout(this.timeoutTimerId);
    this.timeoutTimerId = setTimeout(() => {
      if (this.currentStep === 2 && !this.hasActiveSession()) {
        if (skipBtn) {
          skipBtn.style.border = "2px solid var(--color-primary)";
          skipBtn.style.boxShadow = "0 0 10px rgba(79, 70, 229, 0.3)";
        }
      }
    }, this.SCAN_TIMEOUT_MS);

    // 1. Start camera with selfie/user facing mode
    const cameraResult = await window.ShopCamera.startCamera(videoEl, {
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } }
    });

    // Check if step changed or verification was cancelled during camera start
    if (this.verificationToken !== currentToken || this.currentStep !== 2) {
      window.ShopCamera.stopCamera();
      return;
    }

    if (!cameraResult.success) {
      if (errContainer) {
        window.ShopCamera.renderError(errContainer, cameraResult, {
          onFallback: () => this.completeLogin("demo_bypass_camera_unavailable"),
          fallbackLabel: dict.loginSkipDemo || "Skip face scan (demo mode)",
          onRetry: () => this.startFaceVerification()
        });
      }
      return;
    }

    // 2. Lazily load MediaPipe Tasks Vision if not ready
    await this._ensureMediaPipeLoaded();

    if (this.verificationToken !== currentToken || this.currentStep !== 2) {
      window.ShopCamera.stopCamera();
      return;
    }

    if (this.faceDetectorFailed || !this.faceDetector) {
      // Offline or CDN blocked fallback
      if (statusTextEl) {
        statusTextEl.innerText = dict.loginSkipDemoHint || "Camera unavailable or testing offline? Use demo bypass:";
      }
      return;
    }

    // 3. Start live detection loop
    this.isDetecting = true;
    this._runDetectionLoop();
  }

  /**
   * Lazily loads MediaPipe Tasks Vision from pinned CDN
   */
  async _ensureMediaPipeLoaded() {
    if (this.faceDetector) return;
    if (this.faceDetectorLoading) return;

    this.faceDetectorLoading = true;
    const statusTextEl = document.getElementById("faceStatusText");
    const lang = window.shopStore?.currentLanguage || document.documentElement.lang || "en";
    const dict = (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS[lang]) ? TRANSLATIONS[lang] : {};

    try {
      // Pinned version from jsdelivr
      const visionModule = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
      const { FilesetResolver, FaceDetector } = visionModule;

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      // Try GPU delegate first
      try {
        this.faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU"
          },
          runningMode: "IMAGE"
        });
        this.faceDetectorFailed = false;
      } catch (gpuErr) {
        console.warn("MediaPipe GPU delegate initialization failed, falling back to CPU delegate...", gpuErr);
        // Automatic retry with CPU delegate
        try {
          this.faceDetector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
              delegate: "CPU"
            },
            runningMode: "IMAGE"
          });
          this.faceDetectorFailed = false;
        } catch (cpuErr) {
          console.error("MediaPipe CPU delegate initialization also failed:", cpuErr);
          throw cpuErr;
        }
      }
    } catch (err) {
      // Both GPU and CPU or network offline: graceful fallback without breaking app
      this.faceDetectorFailed = true;
      this.faceDetector = null;
      if (statusTextEl) {
        statusTextEl.innerText = dict.cameraFallbackAction || "Continue with Manual / Demo Option";
      }
    } finally {
      this.faceDetectorLoading = false;
    }
  }

  /**
   * Continuous detection loop (runs at ~15-20 fps to save CPU)
   */
  _runDetectionLoop() {
    if (!this.isDetecting || this.currentStep !== 2) return;

    const videoEl = document.getElementById("loginFaceVideo");
    const statusTextEl = document.getElementById("faceStatusText");
    const statusPillEl = document.getElementById("faceStatusPill");
    const containerEl = document.getElementById("faceViewfinder");
    const lang = window.shopStore?.currentLanguage || document.documentElement.lang || "en";
    const dict = (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS[lang]) ? TRANSLATIONS[lang] : {};

    if (!videoEl || videoEl.readyState < 2 || !this.faceDetector) {
      this.detectionLoopId = requestAnimationFrame(() => this._runDetectionLoop());
      return;
    }

    try {
      const detectionsResult = this.faceDetector.detect(videoEl);

      const frameData = {
        detections: detectionsResult.detections,
        videoWidth: videoEl.videoWidth || 640,
        videoHeight: videoEl.videoHeight || 640,
        timestamp: performance.now()
      };

      // Call the standalone verifyFace function
      const evaluation = verifyFace(frameData);

      if (evaluation.approved) {
        if (!this.steadyStartMs) {
          this.steadyStartMs = performance.now();
        }

        const steadyElapsed = performance.now() - this.steadyStartMs;
        const remainingMs = Math.max(0, this.STEADY_HOLD_DURATION_MS - steadyElapsed);

        if (statusTextEl) {
          statusTextEl.innerText = `${dict.loginFaceHoldStill || "Hold still for verification..."} (${Math.ceil(remainingMs / 1000)}s)`;
        }

        // Held steady for ~1.5s -> APPROVED SUCCESS
        if (steadyElapsed >= this.STEADY_HOLD_DURATION_MS) {
          this._stopDetection();

          if (containerEl) containerEl.classList.add("verified");
          if (statusPillEl) statusPillEl.classList.add("verified");
          if (statusTextEl) statusTextEl.innerText = `✓ ${dict.loginFaceVerified || "Face verified! Welcome, Ravi Sharma."}`;

          // Stop camera immediately
          window.ShopCamera.stopCamera();

          // Smooth transition to dashboard after 600ms
          setTimeout(() => {
            this.completeLogin("credentials_and_face");
          }, 600);
          return;
        }
      } else {
        // Reset steady timer if face moved, lost, or multiple faces
        this.steadyStartMs = null;
        if (statusTextEl) {
          statusTextEl.innerText = dict[evaluation.statusKey] || dict.loginFaceLooking || "Looking for a face...";
        }
      }
    } catch (detectErr) {
      // Detection error handled cleanly
    }

    // Schedule next detection pass (throttled to ~60ms for smooth performance)
    setTimeout(() => {
      if (this.isDetecting) {
        this.detectionLoopId = requestAnimationFrame(() => this._runDetectionLoop());
      }
    }, 60);
  }

  /**
   * Stop detection loop and clear timers
   */
  _stopDetection() {
    this.isDetecting = false;
    if (this.detectionLoopId) {
      cancelAnimationFrame(this.detectionLoopId);
      this.detectionLoopId = null;
    }
    if (this.timeoutTimerId) {
      clearTimeout(this.timeoutTimerId);
      this.timeoutTimerId = null;
    }
  }

  /**
   * Complete login: persist session and enter dashboard
   * @param {string} method - 'credentials_and_face' or 'demo_bypass'
   */
  completeLogin(method = "credentials_and_face") {
    this._stopDetection();
    window.ShopCamera.stopCamera();

    this._saveSession(method);
    this.enterApp(true);
  }

  /**
   * Transition into main application shell
   * @param {boolean} showToast
   */
  enterApp(showToast = true) {
    const loginContainer = document.getElementById("loginContainer");
    const appShell = document.getElementById("app");

    if (loginContainer) {
      loginContainer.style.opacity = "0";
      setTimeout(() => {
        loginContainer.style.display = "none";
        loginContainer.style.opacity = "1";
      }, 250);
    }

    if (appShell) {
      appShell.style.display = "flex";
      appShell.style.opacity = "0";
      setTimeout(() => {
        appShell.style.opacity = "1";
      }, 50);
    }

    // Trigger dashboard bootstrap now that user is authenticated
    if (typeof window.shopAppBootstrap === "function") {
      window.shopAppBootstrap();
    }

    // Update active user & store in UI topbar
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      const sessionUser = stored ? JSON.parse(stored).user : (this.activeUser || DEMO_AUTH_CREDENTIALS.user);
      if (sessionUser) {
        const userNameEl = document.querySelector(".user-name");
        if (userNameEl && sessionUser.name) userNameEl.textContent = sessionUser.name;

        const userAvatarEl = document.querySelector(".user-avatar-initials");
        if (userAvatarEl && sessionUser.name) {
          const initials = sessionUser.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
          userAvatarEl.textContent = initials;
        }

        const roleBadge = document.getElementById("topbarRoleBadge");
        if (roleBadge && sessionUser.role) {
          roleBadge.textContent = sessionUser.role.charAt(0).toUpperCase() + sessionUser.role.slice(1);
        }

        const brandSub = document.querySelector(".brand-subtitle");
        if (brandSub && sessionUser.storeName) {
          brandSub.textContent = sessionUser.storeName;
        }
      }
    } catch (e) {}

    if (showToast && window.shopUI && typeof window.shopUI.showToast === "function") {
      const lang = window.shopStore?.currentLanguage || document.documentElement.lang || "en";
      const dict = (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS[lang]) ? TRANSLATIONS[lang] : {};
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      const sessionUser = stored ? JSON.parse(stored).user : (this.activeUser || DEMO_AUTH_CREDENTIALS.user);
      const greetingName = sessionUser?.name || "Ravi Sharma";
      const msg = (dict.welcomeBackToast || "Welcome back, Ravi Sharma! Store data synchronized.").replace("Ravi Sharma", greetingName);
      window.shopUI.showToast(msg, "success");
    }
  }

  /**
   * Topbar logout: clear session and return to Step 1 login
   */
  logout() {
    this._stopDetection();
    window.ShopCamera.stopCamera();

    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem("shopsahayak_token");
      localStorage.removeItem("shopsahayak_user_email");
    } catch (e) {}

    // Reset password input
    const pwInput = document.getElementById("loginPasswordInput");
    if (pwInput) pwInput.value = "";

    const lang = window.shopStore?.currentLanguage || document.documentElement.lang || "en";
    const dict = (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS[lang]) ? TRANSLATIONS[lang] : {};

    if (window.shopUI && typeof window.shopUI.showToast === "function") {
      window.shopUI.showToast(dict.logoutSuccess || "Logged out successfully.", "info");
    }

    this.showLogin(1);
  }

  /**
   * Bind DOM event listeners
   */
  _bindEvents() {
    // Step 1 Form
    const loginForm = document.getElementById("loginCredentialsForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleCredentialsSubmit();
      });
    }

    // Registration Form Switch Buttons
    const showRegisterBtn = document.getElementById("showRegisterBtn");
    if (showRegisterBtn) {
      showRegisterBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.showRegister();
      });
    }

    const showLoginBtn = document.getElementById("showLoginFromRegBtn");
    if (showLoginBtn) {
      showLoginBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.showLogin(1);
      });
    }

    // Registration Form Submission
    const registerForm = document.getElementById("registerStoreForm");
    if (registerForm) {
      registerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleRegisterSubmit();
      });
    }

    // Show/Hide password toggle
    const pwToggleBtn = document.getElementById("loginPwToggleBtn");
    if (pwToggleBtn) {
      pwToggleBtn.addEventListener("click", () => this.togglePasswordVisibility());
    }

    // Demo Auto-fill Button
    const autofillBtn = document.getElementById("loginDemoFillBtn");
    if (autofillBtn) {
      autofillBtn.addEventListener("click", () => this.autoFillDemo());
    }

    // Step 2 Back to Credentials
    const backBtn = document.getElementById("faceBackLink");
    if (backBtn) {
      backBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.goToStep(1);
      });
    }

    // Demo Bypass Skip Button
    const skipBtn = document.getElementById("faceSkipDemoBtn");
    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        // DEMO-ONLY: Bypasses face scan for resilient presentation
        this.completeLogin("demo_bypass");
      });
    }

    // Topbar Logout Button
    const logoutBtn = document.getElementById("topbarLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.logout());
    }

    // Login Card Language Switchers
    document.querySelectorAll(".login-lang-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const lang = e.currentTarget.getAttribute("data-lang");
        if (window.shopStore) {
          window.shopStore.setLanguage(lang);
        }
        document.querySelectorAll(".login-lang-btn").forEach(b => {
          b.classList.toggle("active", b.getAttribute("data-lang") === lang);
        });
      });
    });
  }
}

// Global Singleton
window.ShopAuth = new ShopAuthManager();
