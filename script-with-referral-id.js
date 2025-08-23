// == Generic Step-by-Step Form Tracker ==
(function () {
    // 1. CONFIGURATION
    const CONFIG = {
        apiUrl: "http://localhost:3002/api/send-message", // Change to your backend URL
        // apiUrl: "https://gateway.claim3000.uk/api/send-message", // Change to your backend URL
        steps: [
            {
                name: "address",
                formSelector: "form#dealform",
                buttonSelector: "button.nextStep",
                stepSelector: '.tab[style*="display: block"]:has([data-step="1"])',
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
                stepSelector: '.tab.hidden[style*="display: block"]:has([data-step="1"])',
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
                stepSelector: '.tab[style*="display: block"]:has([data-step="3"])',
                fields: {
                    email: 'input#email',
                    phoneNumber: 'input#phone',
                    creditCheckConsent: 'input#chekbox2'
                }
            }
        ]
    };

    // 2. REFERRAL HANDLING
    const urlParams = new URLSearchParams(window.location.search);
    const referralFromUrl = urlParams.get("referral");
    if (referralFromUrl) {
        localStorage.setItem("referralId", referralFromUrl); // ✅ Save referral once
    }
    const savedReferral = localStorage.getItem("referralId") || ""; // Always read from localStorage

    // 3. STORAGE HANDLING
    let allFormData = JSON.parse(localStorage.getItem("allFormData")) || {};
    function saveLocal() {
        localStorage.setItem("allFormData", JSON.stringify(allFormData));
    }

    // 4. SERVER SENDING
    function sendToServer(data) {
        const payload = {
            "date-time": Date.now(),
            address_postcode: data.address?.postcode || "",
            leadId: Math.random().toString(36).substring(2, 15),
            address_line_1: data.address?.fullAddress || "",
            first_name: data.personal?.firstName || "",
            last_name: data.personal?.lastName || "",
            email: data.contact?.email || "",
            phone: data.contact?.phoneNumber || "",
            creditCheckConsent: data.contact?.creditCheckConsent ?? false,
            title: data.personal?.title || "",
            iva: data.personal?.iva || "",
            dayOfBirth: data.personal?.dayOfBirth || "",
            monthOfBirth: data.personal?.monthOfBirth || "",
            yearOfBirth: data.personal?.yearOfBirth || "",
            referral: savedReferral, // ✅ Always include referral from localStorage
            hrefs: data.hrefs || [window.location.origin + "/"],
            currentHref: data.hrefs[0] || [window.location.origin + "/"],
            _platform: {
                url: data._platform?.url || window.location.origin,
                fullUrl: data._platform?.fullUrl || window.location.href,
                userAgent: data._platform?.userAgent || navigator.userAgent,
                timestamp: data._platform?.timestamp || new Date().toISOString()
            }
        };

        fetch(CONFIG.apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": "PC-ITF1TNN0CLAIM3000"
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(res => {
            console.log("✅ Data sent:", res);

            // 🧹 Clear local storage after successful send
            localStorage.removeItem("allFormData");
            allFormData = {};
            console.log("🗑️ Local storage cleared after sending data");
        })
        .catch(err => console.error("❌ Send failed:", err));
    }

    // 5. STEP BINDING FUNCTION
    function bindStep(step) {
        const button = document.querySelector(step.buttonSelector);
        if (!button || button.getAttribute(`listener-${step.name}`) === "true") return;

        button.addEventListener("click", function () {
            const currentForm = document.querySelector(step.formSelector);
            if (!currentForm) return;

            const visibleTab = currentForm.querySelector('.tab:not(.hidden)');
            if (!visibleTab && step.formSelector === "form#dealform") return;

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

                const allStepsFilled = CONFIG.steps.every(cfgStep => {
                    const storedStep = allFormData[cfgStep.name];
                    if (!storedStep) return false;
                    return Object.values(storedStep).some(val => val !== "" && val !== false);
                });

                if (allStepsFilled) {
                    sendToServer(allFormData);
                    console.log("📤 All steps complete. Data sent to server.");
                } else {
                    console.log(`📝 Captured ${step.name} step data, waiting for remaining steps.`);
                }
            }
        });

        button.setAttribute(`listener-${step.name}`, "true");
    }

    // 6. POLLING LOOP TO DETECT STEPS
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

    // 7. TRACK ADDRESS LOOKUPS
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
})();
