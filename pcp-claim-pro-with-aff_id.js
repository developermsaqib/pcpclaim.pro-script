// Stepper form Tracker for pcpclaim.pro
(function () {
    // 1. CONFIGURATION
    const CONFIG = {
        apiUrl: "https://gateway.claim3000.uk/api/send-stepper-form",
        ipAdd: null,
        steps: [
            {
                name: "address",
                formSelector: "form#dealform",
                buttonSelector: "button#postcodeBtn",
                stepSelector: '.tab:not(.hidden)',
                fields: {
                    postcode: 'input#postcode',
                    towncity: 'input[name="towncity"]',
                    street: 'input[name="street"]',
                    building: 'input[name="building"]',
                    province: 'input[name="province"]',
                    fullAddress: 'input[name="fullAddress"]',
                    selectedAddress: '.selectedAddress',
                    prevpostcode: 'input#prevpostcode',
                    prevtowncity: 'input[name="prevtowncity"]',
                    prevstreet: 'input[name="prevstreet"]',
                    prevbuilding: 'input[name="prevbuilding"]',
                    prevprovince: 'input[name="prevprovince"]',
                    prevfullAddress: 'input[name="prevfullAddress"]',
                    prevselectedAddress: '.prevselectedAddress'
                }
            },
            {
                name: "personal",
                formSelector: "form#dealform",
                buttonSelector: "button.nextStep",
                stepSelector: '.tab.hidden:not([style*="display: none"])',
                fields: {
                    title: 'input[name="title"]:checked',
                    iva: 'input[name="iva"]:checked',
                    firstName: 'input#first-name',
                    lastName: 'input#last-name',
                    dayOfBirth: 'select#dayOfBirth',
                    monthOfBirth: 'select#monthOfBirth',
                    yearOfBirth: 'select#yearOfBirth'
                }
            },
            {
                name: "contact",
                formSelector: "form#dealform",
                buttonSelector: "button.nextStep",
                stepSelector: '.tab.hidden.lastTab:not([style*="display: none"])',
                fields: {
                    email: 'input#email',
                    phoneNumber: 'input#phone',
                    termsConsent: 'input.form-checkbox',
                    creditCheckConsent: 'input.form-checkbox2'
                }
            }
        ]
    };

    // prevent double submissions
    let hasSent = false;
    let isSubmitting = false;

    // 2. UPDATED REFERRAL HANDLING - Check for aff_id=666
    const urlParams = new URLSearchParams(window.location.search);
    const affId = urlParams.get("aff_id");
    const referralFromUrl = urlParams.get("referral");
    
    let isPixelLead = false;
    let savedReferral = "";

    // Check conditions for lead type
    if (affId === "666") {
        if (referralFromUrl) {
            // Pixel lead: aff_id=666 AND referral=some_value
            isPixelLead = true;
            localStorage.setItem("referralId", referralFromUrl);
            savedReferral = referralFromUrl;
            console.log("🎯 Pixel lead detected - aff_id=666 with referral:", referralFromUrl);
        } else {
            // Non-pixel lead: aff_id=666 only (no referral)
            isPixelLead = false;
            savedReferral = "";
            console.log("🎯 Non-pixel lead detected - aff_id=666 without referral");
        }
    } else {
        // No aff_id=666, check for existing referral in localStorage
        savedReferral = localStorage.getItem("referralId") || "";
        isPixelLead = !!savedReferral;
        console.log("🎯 No aff_id=666 found, using stored referral:", savedReferral);
    }

    // 3. STORAGE HANDLING
    let allFormData = JSON.parse(localStorage.getItem("allFormData")) || {};
    function saveLocal() {
        localStorage.setItem("allFormData", JSON.stringify(allFormData));
    }

    // 4. GET SIGNATURE AS BASE64
    function getSignatureBase64() {
        const canvas = document.querySelector('#signature-pad');
        if (canvas) {
            try {
                return canvas.toDataURL(); // Returns base64 string
            } catch (e) {
                console.warn('Could not get signature as base64:', e);
                return "";
            }
        }
        return "";
    }

    // Re-collect address fields right before sending to guarantee step1 data is present
    function ensureAddressData() {
        const f = CONFIG.steps.find(s => s.name === "address")?.fields || {};
        const getText = sel => (document.querySelector(sel)?.textContent || "").trim();
        const getVal = sel => document.querySelector(sel)?.value || "";

        const addr = {
            postcode: getVal(f.postcode),
            towncity: getVal(f.towncity),
            street: getVal(f.street),
            building: getVal(f.building),
            province: getVal(f.province),
            fullAddress: getVal(f.fullAddress),
            selectedAddress: getText(f.selectedAddress),

            prevpostcode: getVal(f.prevpostcode),
            prevtowncity: getVal(f.prevtowncity),
            prevstreet: getVal(f.prevstreet),
            prevbuilding: getVal(f.prevbuilding),
            prevprovince: getVal(f.prevprovince),
            prevfullAddress: getVal(f.prevfullAddress),
            prevselectedAddress: getText(f.prevselectedAddress),
        };

        // Merge into allFormData.address (only fill blanks or replace entirely)
        allFormData.address = { ...(allFormData.address || {}), ...addr };
        saveLocal();
    }

    //Get IP Address
    async function ip() {
        try {
            const response = await fetch("https://api.ipify.org/?format=json");
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error("Error fetching IP address:", error);
            return null;
        }
    }

    (async () => {
        CONFIG.ipAdd = await ip(); // wait for the result
    })();

    //Get device and os info
    function getDeviceAndOS() {
        const ua = navigator.userAgent;

        // Detect OS
        let os = "Unknown";
        if (/windows/i.test(ua)) os = "Windows";
        else if (/macintosh|mac os x/i.test(ua)) os = "MacOS";
        else if (/linux/i.test(ua)) os = "Linux";
        else if (/android/i.test(ua)) os = "Android";
        else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";

        // Detect Device
        let device = "Desktop";
        if (/mobile/i.test(ua)) device = "Mobile";
        else if (/tablet|ipad/i.test(ua)) device = "Tablet";

        return { os, device, ua };
    }

    const { os, device, ua } = getDeviceAndOS();
    console.log("OS:", os);
    console.log("Device:", device);
    console.log("USER AGENT:", ua);

    // 5. UPDATED SERVER SENDING - Use aff_id=666 check instead of referral check
    function sendToServer(data) {
        if (hasSent || isSubmitting) {
            console.warn("⚠️ Submit already in progress or done. Skipping duplicate.");
            return;
        }
        isSubmitting = true;

        // Make sure address is up-to-date so step1 is never missed
        ensureAddressData();

        // Get signature as base64 before sending
        const signatureBase64 = getSignatureBase64();

        let payload = {};
        let headers = {};

        // Use isPixelLead flag to determine which structure to use
        if (!isPixelLead) {
            // Non-pixel lead: aff_id=666 only (no referral) - Use PCP CLAIM structure
            headers = {
                "Content-Type": "application/json",
            };

            CONFIG.apiUrl = "https://gateway.claim3000.uk/api/send-pcp-claim-lead";
            console.log("📤 Sending Data to PCP CLAIM ENDPOINT (Non-pixel lead)");

            payload = {
                payload: {
                    "date-time": Date.now(),
                    "title": data.personal?.title || "",
                    "name_first": data.personal?.firstName || "",
                    "name_last": data.personal?.lastName || "",
                    "date_of_birth": `${data.personal?.yearOfBirth || data.personal?.year || ""}-${data.personal?.monthOfBirth || data.personal?.month || ""}-${data.personal?.dayOfBirth || data.personal?.day || ""} `,
                    "mobile": data.contact?.phoneNumber || "",
                    "email_address": data.contact?.email || "",
                    "signature": signatureBase64,
                    "address_line_1": data.address.selectedAddress || data.address?.fullAddress || data.address?.building || data.address?.street || "",
                    "address_postcode": data.address?.postcode || "",
                    "additional_lenders": data.additionalLenders || [], // dynamic if you capture lenders
                    "claim_pdf_file": data.claimPdf || "",               // dynamic if generated
                    "ip_address": (CONFIG.ipAdd || null),            // optional: inject server-side
                    "browser": ua || null,
                    "device": device || null, // you could detect mobile/desktop
                    "os": os || null,     // you could parse from UA
                    "claims": data.claims || [] // dynamic contracts list if captured
                }
            };
        } else {
            // Pixel lead: aff_id=666 AND referral=some_value - Use stepper form structure
            headers = {
                "Content-Type": "application/json",
            };

            CONFIG.apiUrl = "https://gateway.claim3000.uk/api/send-stepper-form";
            console.log("📤 Sending Data to STEPPER FORM ENDPOINT (Pixel lead)");

            payload = {
                allFormData: {
                    referralId: savedReferral,
                    regNo: "", // Add vehicle registration if available
                    addressData: {
                        "Address Line 1": data.address?.fullAddress || "",
                        "post_town": data.address?.towncity || "",
                        "county": data.address?.province || "",
                        "postcode": data.address?.postcode || ""
                    },
                    contactData: {
                        title: data.personal?.title || "",
                        firstName: data.personal?.firstName || "",
                        lastName: data.personal?.lastName || "",
                        day: data.personal?.dayOfBirth || data.personal?.day || "",
                        month: data.personal?.monthOfBirth || data.personal?.month || "",
                        year: data.personal?.yearOfBirth || data.personal?.year || ""
                    },
                    commData: {
                        mobile: data.contact?.phoneNumber || "",
                        email: data.contact?.email || ""
                    },
                    vehicleData: [], // Add vehicle data if available
                    personalData: {
                        title: data.personal?.title || "",
                        first_name: data.personal?.firstName || "",
                        lastName: data.personal?.lastName || "",
                        day: data.personal?.dayOfBirth || data.personal?.day || "",
                        month: data.personal?.monthOfBirth || data.personal?.month || "",
                        year: data.personal?.yearOfBirth || data.personal?.year || "",
                        mobile: data.contact?.phoneNumber || "",
                        email: data.contact?.email || "",
                        buildingNumber: data.address?.building || "",
                        buildingName: data.address?.building || "",
                        street: data.address?.street || "",
                        town: data.address?.towncity || "",
                        postcode: data.address?.postcode || "",
                        county: data.address?.province || "",
                        iva: data.personal?.iva || "",
                        signature: signatureBase64
                    },
                    imageData: signatureBase64,
                    hrefs: data.hrefs || [window.location.href]
                },
                leadId: Date.now().toString(),
                referralId: savedReferral,
                currentHref: window.location.href,
                event: "Server event",
                message: "New lead received",
                is_deleted: false
            };
        }

        fetch(CONFIG.apiUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(res => {
                console.log("✅ Data sent:", res);

                // 🧹 Clear local storage after successful send
                localStorage.removeItem("allFormData");
                allFormData = {};
                hasSent = true;
                console.log("🗑️ Local storage cleared after sending data");
            })
            .catch(err => console.error("❌ Send failed:", err))
            .finally(() => {
                isSubmitting = false;
            });
    }

    // 6. STEP BINDING FUNCTION (ORIGINAL LOGIC PRESERVED, but only final step can send)
    function bindStep(step) {
        const button = document.querySelector(step.buttonSelector);
        if (!button || button.getAttribute(`listener-${step.name}`) === "true") return;

        button.addEventListener("click", function () {
            const currentForm = document.querySelector(step.formSelector);
            if (!currentForm) return;

            const stepData = {};
            for (let fieldName in step.fields) {
                const selector = step.fields[fieldName];
                const el = document.querySelector(selector);

                if (el) {
                    if (el.type === 'checkbox') {
                        stepData[fieldName] = el.checked;
                    } else if (el.type === 'radio') {
                        stepData[fieldName] = el.checked ? el.value : "";
                    } else if (el.tagName === 'SELECT') {
                        stepData[fieldName] = el.value || "";
                    } else if (el.classList && (el.classList.contains('selectedAddress') || el.classList.contains('prevselectedAddress'))) {
                        stepData[fieldName] = el.textContent.trim() || "";
                    } else {
                        stepData[fieldName] = el.value || "";
                    }
                } else {
                    stepData[fieldName] = "";
                }
            }

            const hasData = Object.values(stepData).some(value => value !== "" && value !== false);

            if (hasData) {
                allFormData[step.name] = stepData;
                allFormData.hrefs = allFormData.hrefs || [];
                if (!allFormData.hrefs.includes(window.location.href)) {
                    allFormData.hrefs.push(window.location.href);
                }
                console.log(`📝 Captured ${step.name} step data:`, stepData);
                saveLocal();

                // ✅ Only allow the LAST step to trigger sending.
                if (step.name === "contact") {
                    // Optional: verify we have some address data; if not, pull it now.
                    ensureAddressData();
                    sendToServer(allFormData);
                    console.log("📤 Final step complete. Data sent to server (guarded).");
                } else {
                    console.log(`📝 Captured ${step.name} step data, waiting for remaining steps.`);
                }
            }
        });

        button.setAttribute(`listener-${step.name}`, "true");
    }

    // 7. POLLING LOOP TO DETECT STEPS (ORIGINAL LOGIC)
    setInterval(function () {
        CONFIG.steps.forEach(step => {
            const form = document.querySelector(step.formSelector);
            if (form) {
                if (step.formSelector === "form#dealform") {
                    if (step.stepSelector) {
                        const stepElement = document.querySelector(step.stepSelector);
                        if (stepElement) {
                            bindStep(step);
                        }
                    } else {
                        const hasVisibleFields = Object.values(step.fields).some(selector => {
                            const el = document.querySelector(selector);
                            return el && el.offsetParent !== null;
                        });
                        if (hasVisibleFields) {
                            bindStep(step);
                        }
                    }
                } else {
                    bindStep(step);
                }
            }
        });
    }, 1000);

    // 8. TRACK ADDRESS LOOKUPS (ORIGINAL LOGIC)
    function trackAddressLookup() {
        const postcodeBtn = document.querySelector('#postcodeBtn');
        const prevPostcodeBtn = document.querySelector('#prevpostcodeBtn');

        if (postcodeBtn && !postcodeBtn.getAttribute('lookup-listener')) {
            postcodeBtn.addEventListener('click', function () {
                const postcode = document.querySelector('#postcode').value;
                if (postcode) {
                    allFormData.addressLookups = allFormData.addressLookups || [];
                    allFormData.addressLookups.push({
                        type: 'current',
                        postcode: postcode,
                        timestamp: new Date().toISOString()
                    });
                    saveLocal();
                    console.log('📍 Address lookup:', postcode);
                }
            });
            postcodeBtn.setAttribute('lookup-listener', 'true');
        }

        if (prevPostcodeBtn && !prevPostcodeBtn.getAttribute('lookup-listener')) {
            prevPostcodeBtn.addEventListener('click', function () {
                const postcode = document.querySelector('#prevpostcode').value;
                if (postcode) {
                    allFormData.addressLookups = allFormData.addressLookups || [];
                    allFormData.addressLookups.push({
                        type: 'previous',
                        postcode: postcode,
                        timestamp: new Date().toISOString()
                    });
                    saveLocal();
                    console.log('📍 Previous address lookup:', postcode);
                }
            });
            prevPostcodeBtn.setAttribute('lookup-listener', 'true');
        }
    }

    setInterval(trackAddressLookup, 1000);

    console.log('🚀 Form tracker initialized with', CONFIG.steps.length, 'steps');
    console.log('🎯 Lead type:', isPixelLead ? 'Pixel Lead' : 'Non-Pixel Lead');
    console.log('🔗 Referral ID:', savedReferral || 'None');
})();