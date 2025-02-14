// ==UserScript==
// @name         CM_Shipping_Estimate
// @description  Add shipping estimate under single card price
// @version      0.4.0
// @author       Topi Salonen
// @namespace    https://topi.dev/
// @match        https://www.cardmarket.com/*/Products/Singles/*
// @match        https://www.cardmarket.com/*/Cards/*
// @exclude      https://www.cardmarket.com/*/Cards/*/Versions
// @icon         data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📦</text></svg>
// @grant        GM.xmlHttpRequest
// @grant        GM.setValue
// @grant        GM.getValue
// ==/UserScript==

const isDesktop = window.matchMedia("(min-width: 576px)").matches;

const yearToday = new Date().getFullYear();

// List of countries, fetched from https://help.cardmarket.com/en/ShippingCosts
// Updated on Jan 2025, might get changed in the future
const countriesList = [
    {
        "name": "-",
        "value": 0
    },
    {
        "name": "Austria",
        "value": 1
    },
    {
        "name": "Belgium",
        "value": 2
    },
    {
        "name": "Bulgaria",
        "value": 3
    },
    {
        "name": "Croatia",
        "value": 35
    },
    {
        "name": "Cyprus",
        "value": 5
    },
    {
        "name": "Czech Republic",
        "value": 6
    },
    {
        "name": "Denmark",
        "value": 8
    },
    {
        "name": "Estonia",
        "value": 9
    },
    {
        "name": "Finland",
        "value": 11
    },
    {
        "name": "France",
        "value": 12
    },
    {
        "name": "Germany",
        "value": 7
    },
    {
        "name": "Greece",
        "value": 14
    },
    {
        "name": "Hungary",
        "value": 15
    },
    {
        "name": "Iceland",
        "value": 37
    },
    {
        "name": "Ireland",
        "value": 16
    },
    {
        "name": "Italy",
        "value": 17
    },
    {
        "name": "Japan",
        "value": 36
    },
    {
        "name": "Latvia",
        "value": 21
    },
    {
        "name": "Liechtenstein",
        "value": 18
    },
    {
        "name": "Lithuania",
        "value": 19
    },
    {
        "name": "Luxembourg",
        "value": 20
    },
    {
        "name": "Malta",
        "value": 22
    },
    {
        "name": "Netherlands",
        "value": 23
    },
    {
        "name": "Norway",
        "value": 24
    },
    {
        "name": "Poland",
        "value": 25
    },
    {
        "name": "Portugal",
        "value": 26
    },
    {
        "name": "Romania",
        "value": 27
    },
    {
        "name": "Singapore",
        "value": 29
    },
    {
        "name": "Slovakia",
        "value": 31
    },
    {
        "name": "Slovenia",
        "value": 30
    },
    {
        "name": "Spain",
        "value": 10
    },
    {
        "name": "Sweden",
        "value": 28
    },
    {
        "name": "Switzerland",
        "value": 4
    },
    {
        "name": "United Kingdom",
        "value": 13
    },
    {
        "name": "-",
        "value": 0
    },
    {
        "name": "Austria",
        "value": 1
    },
    {
        "name": "Belgium",
        "value": 2
    },
    {
        "name": "Bulgaria",
        "value": 3
    },
    {
        "name": "Croatia",
        "value": 35
    },
    {
        "name": "Cyprus",
        "value": 5
    },
    {
        "name": "Czech Republic",
        "value": 6
    },
    {
        "name": "Denmark",
        "value": 8
    },
    {
        "name": "Estonia",
        "value": 9
    },
    {
        "name": "Finland",
        "value": 11
    },
    {
        "name": "France",
        "value": 12
    },
    {
        "name": "Germany",
        "value": 7
    },
    {
        "name": "Greece",
        "value": 14
    },
    {
        "name": "Hungary",
        "value": 15
    },
    {
        "name": "Iceland",
        "value": 37
    },
    {
        "name": "Ireland",
        "value": 16
    },
    {
        "name": "Italy",
        "value": 17
    },
    {
        "name": "Japan",
        "value": 36
    },
    {
        "name": "Latvia",
        "value": 21
    },
    {
        "name": "Liechtenstein",
        "value": 18
    },
    {
        "name": "Lithuania",
        "value": 19
    },
    {
        "name": "Luxembourg",
        "value": 20
    },
    {
        "name": "Malta",
        "value": 22
    },
    {
        "name": "Netherlands",
        "value": 23
    },
    {
        "name": "Norway",
        "value": 24
    },
    {
        "name": "Poland",
        "value": 25
    },
    {
        "name": "Portugal",
        "value": 26
    },
    {
        "name": "Romania",
        "value": 27
    },
    {
        "name": "Singapore",
        "value": 29
    },
    {
        "name": "Slovakia",
        "value": 31
    },
    {
        "name": "Slovenia",
        "value": 30
    },
    {
        "name": "Spain",
        "value": 10
    },
    {
        "name": "Sweden",
        "value": 28
    },
    {
        "name": "Switzerland",
        "value": 4
    },
    {
        "name": "United Kingdom",
        "value": 13
    }
];

const getArticleId = (articleElem) => {
    return articleElem.id.substr(10);
}

const getDataValue = (elem) => {
    if (!elem) return;
    const dataBsOriginalTitle = elem.getAttribute('data-bs-original-title');
    if (dataBsOriginalTitle) return dataBsOriginalTitle;

    return elem.getAttribute('title');
}

const getShipToValue = async () => {
    const storedCountryValue = await GM.getValue('country-value');
    if (storedCountryValue) return storedCountryValue;

    const sellerInfo = document.querySelector('span.seller-extended');
    const deliveryEstimateToolip = sellerInfo.querySelector('span.fonticon-calendar');
    const tooltipDataStr = getDataValue(deliveryEstimateToolip);
    const splitDataStr = tooltipDataStr.split(' ');

    // Country name is the next value after "to"
    const toCountryName = splitDataStr.find((_, i, arr) => arr[i - 1] && arr[i - 1] === 'to');
    const listedCountry = countriesList.find(({name}) => name === toCountryName);
    if (!listedCountry) return;

    await GM.setValue('country-value', listedCountry.value);
    return listedCountry;
};

const getShipFromValue = (articleElem) => {
    const sellerNameElem = articleElem.querySelector('span.seller-name');
    const flagElem = sellerNameElem.querySelector('span.icon');
    const sellerLocationStr = getDataValue(flagElem);
    if (!sellerLocationStr) return;

    const countryNameStr = sellerLocationStr.split(': ')[1];
    const listedCountry = countriesList.find(({name, value}) => name === countryNameStr);
    if (!listedCountry) return;

    return listedCountry.value;
}

const getPostageFromTo = async (shipFrom, shipTo) => {
    if (!shipFrom || !shipTo) return;

    const storedValues = await GM.getValue('postageValues') || [];

    // Check if we have stored a value already and use that
    if (storedValues?.length) {
        const existingValueIndex = storedValues.findIndex(val => val.id === shipFrom + '_' + shipTo);
        const existingValue = storedValues[existingValueIndex];

        if (existingValue) {
            if (yearToday > existingValue.yearUpdated) {
                // Prices should only update at year start
                // Remove expired value and continue to fetch
                storedValues.splice(existingValueIndex, 1);
            } else {
                // Return existing value
                return existingValue;
            }
        }
    }

    const result = await new Promise((resolve, reject) => {
        GM.xmlHttpRequest({
            method: 'GET',
            url: 'https://help.cardmarket.com/api/shippingCosts?locale=en&fromCountry=' + shipFrom + '&toCountry=' + shipTo + '&preview=false',
            onload: response => resolve(JSON.parse(response.responseText)),
            onerror: error => reject(error)
        });
    });

    if (!result) return;

    const newValue = {
        yearUpdated: yearToday,
        id: shipFrom + '_' + shipTo,
        shipFrom,
        shipTo,
        postageOptions: result,
    };

    console.log('CM_Shipping_Estimate: Fetched new value for postage from ' + shipFrom + ' to ' + shipTo);
    await GM.setValue('postageValues', [...storedValues, newValue]);
    return newValue;
}

const getTrackingRequired = (articleElem) => {
    const priceContainer = articleElem.querySelector('div.price-container');

    // Get full euro price e.g. '1,25 €' => 1 (the comma causes NaN and the cents don't matter)
    const articlePrice = Number(priceContainer.innerText.split(',')[0]);

    // "Only tracked shipment to ***." element next to price
    const trackingNotifier = priceContainer.querySelector("span[data-bs-toggle='tooltip']");

    // "Untracked shipping is not eligible" element next to user name
    const trackingNotifier2 = articleElem.querySelector('span.untracked');

    return !!trackingNotifier || !!trackingNotifier2 || articlePrice >= 25;
}

const displayPostagePriceEstimate = async (articleElem, shipFrom, shipTo) => {
    const postage = await getPostageFromTo(shipFrom, shipTo);
    if (!postage?.postageOptions?.length) return;

    const priceContainer = isDesktop ? articleElem.querySelector('div.price-container') : articleElem.querySelector('div.mobile-offer-container')?.children[1];
    if (!priceContainer) return;

    priceContainer.style['flex-direction'] = 'column';
    priceContainer.style['align-items'] = 'baseline';

    // Find cheapest shipping estimate
    const trackingRequired = getTrackingRequired(articleElem);
    const cheapestPostageOption = trackingRequired ? postage.postageOptions.find(val => val.isTracked) : postage.postageOptions[0];
    const {price, maxWeight} = cheapestPostageOption;

    // Create postage price element
    const articleId = getArticleId(articleElem);
    const postagePriceElem = document.createElement('span');
    postagePriceElem.id = 'CM_Shipping_Estimate_' + articleId;
    postagePriceElem.innerText = '(' + price + ' / ' + maxWeight + 'g)';
    postagePriceElem.style['font-size'] = '0.5rem';

    priceContainer.append(postagePriceElem);

    // Fix article layout on mobile
    if (!isDesktop) {
        articleElem.style['max-width'] = '100vw';
    }
}

const displayAvailableItems = (articleElem) => {
    const articleId = getArticleId(articleElem);

    const sellCountElem = articleElem.querySelector('span.sell-count');
    const dataValue = getDataValue(sellCountElem);

    if (!dataValue) return;

    const colSeller = articleElem.querySelector('div.col-seller');
    colSeller.style['flex-direction'] = 'column';
    colSeller.style['align-items'] = 'flex-start';

    const sellerInfoElem = document.createElement('span');
    sellerInfoElem.id = 'CardmarketShip_SellerInfo_' + articleId;
    sellerInfoElem.style['font-size'] = '0.5rem';
    sellerInfoElem.style['font-size'] = '0.5rem';
    sellerInfoElem.innerText = dataValue;

    colSeller.append(sellerInfoElem);
};

const hideNotShippingEntry = (articleElem) => {
    const disabledAddToCartButton = articleElem.querySelector("a[role='button']");

    if (getDataValue(disabledAddToCartButton) === "You cannot buy the offered item, because the seller does not ship to your country. The seller may also be on your blacklist, or vice versa.") {
        articleElem.style.cssText += 'display: none !important;';
    }
};

const createShippingEstimate = async (articleElem, shipTo) => {
    const shipFrom = getShipFromValue(articleElem);

    await displayPostagePriceEstimate(articleElem, shipFrom, shipTo);
    displayAvailableItems(articleElem);
    hideNotShippingEntry(articleElem);

    const submitButton = articleElem.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.onclick = () => {
            addSubmitListener(articleElem, shipTo);
        };
    }
};

const updateShippingEstimates = async (shipTo) => {
    const table = document.querySelector('div.table-body');

    const promises = [];
    Array.from(table.children).forEach(articleElem => {
        const articleId = getArticleId(articleElem);
        const existingPostagePriceElem = articleElem.querySelector('span#CM_Shipping_Estimate_' + articleId);

        // Skip if already handled
        if (!existingPostagePriceElem) {
            promises.push(createShippingEstimate(articleElem, shipTo));
        }
    });

    if (promises.length) {
        await Promise.all(promises);
    }

    console.log('CM_Shipping_Estimate: Shipping estimated loaded');
};

const addSubmitListener = (articleElem, shipTo, retry) => {
    // Close previous system message and try again
    const systemMessage = document.querySelector('div.systemMessage');
    if (systemMessage) {
        if (!retry) {
            const closeSystemMessageButton = systemMessage.querySelector('button');
            closeSystemMessageButton.click();
        }

        setTimeout(() => {
            addSubmitListener(articleElem, shipTo, true);
        }, 100);

        return;
    }

    // Use interval to wait until success/fail heading appears
    let retries = 0;
    const systemMessageInterval = setInterval(() => {
        retries++;
        if (retries > 10) {
            console.error('CM_Shipping_Estimate: Failed to get system message');
            clearInterval(systemMessageInterval);
        }

        const systemMessage = document.querySelector('div.systemMessage');
        if (!systemMessage) return;

        // Element found, clear interval
        clearInterval(systemMessageInterval);

        if (systemMessage.innerText.trim() === 'Your request was executed successfully') {
            // Re-add estimate, previous article got replaced by a new one
            const newArticleElem = document.querySelector('div#' + articleElem.id);
            if (newArticleElem) createShippingEstimate(newArticleElem, shipTo);
        }
    }, 200);
};

const addLoadMoreListener = (shipTo) => {
    const loadMoreElem = document.querySelector('div#loadMore');
    const loadMoreButton = loadMoreElem.querySelector('button#loadMoreButton');

    loadMoreButton.addEventListener('click', function() {
        // Wait until spinner stops
        let retries = 0;
        const spinnerLoadInterval = setInterval(() => {
            retries++;
            if (retries > 10) {
                console.error('CM_Shipping_Estimate: Loading spinner stuck');
                clearInterval(spinnerLoadInterval);
            }

            const loadMoreSpinner = loadMoreElem.querySelector('div.loader');
            if (loadMoreSpinner) return;

            clearInterval(spinnerLoadInterval);
            updateShippingEstimates(shipTo);
        }, 200);
    });
};

(async () => {
    'use strict';

    console.log('CM_Shipping_Estimate: Initialised');

    const shipTo = await getShipToValue();
    if (!shipTo) {
        console.error('CM_Shipping_Estimate: Failed to get shipTo value');
        return;
    }

    addLoadMoreListener(shipTo);
    await updateShippingEstimates(shipTo);
})();
