// == Generic Step-by-Step Form Tracker ==
(function () {
    // 1. CONFIGURATION
    const CONFIG = {
        apiUrl: "http://localhost:3002/api/send-message", // Change to your backend URL
        steps: [
            {
                name: "address",
                formSelector: "form#dealform", // Main form selector
                buttonSelector: "button.nextStep", // Continue button selector
                stepSelector: '.tab[style*="display: block"]:has([data-step="1"])', // Check for visible address step
                fields: {
                    postcode: 'input#postcode',
                    towncity: 'input[name="towncity"]',
                    street: 'input[name="street"]',
                    building: 'input[name="building"]',
                    province: 'input[name="province"]',
                    fullAddress: 'input[name="fullAddress"]',
                    selectedAddress: '.selectedAddress', // Capture displayed selected address
                    // Previous address fields (if filled)
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
                formSelector: "form#dealform", // Same form, different step
                buttonSelector: "button.nextStep", // Same continue button
                stepSelector: '.tab.hidden[style*="display: block"]:has([data-step="1"])', // Check for personal step (2nd tab)
                fields: {
                    title: 'input[name="title"]:checked', // Get selected radio button
                    iva: 'input[name="iva"]:checked', // Get selected radio button
                    firstName: 'input#first-name', // Updated to use ID selector
                    lastName: 'input#last-name', // Updated to use ID selector  
                    dayOfBirth: 'select#dayOfBirth', // Updated to use ID selector
                    monthOfBirth: 'select#monthOfBirth', // Updated to use ID selector
                    yearOfBirth: 'select#yearOfBirth' // Updated to use ID selector
                }
            },
            {
                name: "contact",
                formSelector: "form#dealform", // Same form, different step
                buttonSelector: "button.nextStep", // Same continue button
                stepSelector: '.tab[style*="display: block"]:has([data-step="3"])', // Check for visible contact step
                fields: {
                    email: 'input#email', // Updated to use ID selector
                    phoneNumber: 'input#phone', // Updated to use ID selector
                    creditCheckConsent: 'input#chekbox2' // Checkbox for credit check consent
                }
            }
            
        ]
    };

    // 2. STORAGE HANDLING
    let allFormData = JSON.parse(localStorage.getItem("allFormData")) || {};
    function saveLocal() {
        localStorage.setItem("allFormData", JSON.stringify(allFormData));
    }

    // 3. SERVER SENDING
    function sendToServer(data) {
    const payload = {
        "date-time": Date.now(),
        address_postcode:data.address?.postcode || "",
        address_line_1:data.address?.fullAddress || "",
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
        hrefs: data.hrefs || [window.location.origin + "/"],
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


    // 4. ENHANCED STEP BINDING FUNCTION
    function bindStep(step) {
        const button = document.querySelector(step.buttonSelector);
        if (!button || button.getAttribute(`listener-${step.name}`) === "true") return;

        button.addEventListener("click", function () {
            // Only capture data if we're on the right step/tab
            const currentForm = document.querySelector(step.formSelector);
            if (!currentForm) return;

            // Check if this is the active tab for multi-step forms
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
                        // For address display elements, get text content
                        stepData[fieldName] = el.textContent.trim() || "";
                    } else {
                        stepData[fieldName] = el.value || "";
                    }
                } else {
                    stepData[fieldName] = "";
                }
            }

            // Only save if we actually have some data
            const hasData = Object.values(stepData).some(value =>
                value !== "" && value !== false
            );

            if (hasData) {
                allFormData[step.name] = stepData;
                allFormData.hrefs = allFormData.hrefs || [];
                if (!allFormData.hrefs.includes(window.location.href)) {
                    allFormData.hrefs.push(window.location.href);
                }
                console.log(`📝 Captured ${step.name} step data:`, stepData);
                saveLocal();

                // ✅ Check if all steps are filled before sending
                const allStepsFilled = CONFIG.steps.every(cfgStep => {
                    const storedStep = allFormData[cfgStep.name];
                    if (!storedStep) return false;
                    // Ensure at least one non-empty value in the stored step
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

    // 5. ENHANCED POLLING LOOP TO DETECT STEPS
    setInterval(function () {
        CONFIG.steps.forEach(step => {
            const form = document.querySelector(step.formSelector);
            if (form) {
                // For the dealform, check if the relevant fields are visible
                if (step.formSelector === "form#dealform") {
                    // Check if this specific step is active
                    if (step.stepSelector) {
                        const stepElement = document.querySelector(step.stepSelector);
                        if (stepElement) {
                            bindStep(step);
                        }
                    } else {
                        // Fallback to checking if any relevant fields are visible
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

    // 6. ADDITIONAL TRACKING FOR ADDRESS LOOKUP BUTTONS
    // Track postcode lookup interactions
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

    // Run address lookup tracking
    setInterval(trackAddressLookup, 1000);

    console.log('🚀 Form tracker initialized with', CONFIG.steps.length, 'steps');
})();