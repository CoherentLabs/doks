const config = {
    hideFromBots: true,
    // See https://github.com/orestbida/cookieconsent#how-to-enablemanage-revisions
    // Left for future reference if we change the consent.
    // revision: 0,
    cookie: {
        name: "cc_cookie",
        domain: location.hostname,
        expiresAfterDays: 365,
    },
    categories: {
        necessary: {
            readOnly: true
        },
        analytics: {
            autoClear: {
                cookies: [
                    {
                        name: /^_ga/, // regex: match all cookies starting with '_ga'
                    },
                    {
                        name: "_gid", // string: exact cookie name
                    },
                ],
            },
        },
    },
    language: {
        default: "en",
        translations: {
            en: {
                consentModal: {
                    title: "We use cookies!",
                    description:
                        'Hi, this website uses essential cookies to ensure its proper operation and tracking cookies to understand how you interact with it. The latter will be set only after consent. <a data-cc="show-preferencesModal" class="cc-link">Let me choose</a>',
                    acceptAllBtn: "Accept all",
                    acceptNecessaryBtn: "Reject all",
                    showPreferencesBtn: "Manage Individual preferences",
                },
                preferencesModal: {
                    title: "Cookie preferences",
                    acceptAllBtn: "Accept all",
                    acceptNecessaryBtn: "Reject all",
                    savePreferencesBtn: "Save settings",
                    closeIconLabel: "Close",
                    serviceCounterLabel: "Service|Services",
                    sections: [
                        {
                            title: "Cookie usage 📢",
                            description: `Cookies are used to ensure the basic functionalities of the website and to enhance your online experience. You can choose for each category to opt-in/out whenever you want. For more details relative to cookies and other sensitive data, please read the full <a href="/privacy-policy" class="cc-link" target="_blank">privacy policy</a>.`,
                        },
                        {
                            title: "Strictly necessary cookies",
                            description:
                                "These cookies are essential for the proper functioning of my website. Without these cookies, the website may not work properly.",
                            linkedCategory: "necessary",
                        },
                        {
                            title: "Performance and Analytics cookies",
                            description:
                                "These cookies allow the website to remember the choices you have made in the past.",
                            linkedCategory: "analytics",
                            cookieTable: {
                                caption: "Cookie table",
                                headers: {
                                    name: "Cookie",
                                    domain: "Domain",
                                    desc: "Description",
                                    duration: "Duration",
                                },
                                body: [
                                    {
                                        name: "_ga",
                                        domain: 'google.com',
                                        desc: "This cookie is a Google Analytics persistent cookie.",
                                        duration: "2 years",
                                    },
                                    {
                                        name: "_gid",
                                        domain: 'google.com',
                                        desc: "This cookie is a Google Analytics persistent cookie.",
                                        duration: "1 day",
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        },
    },
};

CookieConsent.run(config);
