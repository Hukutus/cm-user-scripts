// ==UserScript==
// @name         CM_Offers_UI
// @description  Rewrite Cardmarket Offers UI to be nicer to use
// @version      0.9.0
// @author       Topi Salonen
// @namespace    https://topi.dev/
// @match        https://www.cardmarket.com/*/Offers/*
// @icon         data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💸</text></svg>
// @grant        GM.addStyle
// ==/UserScript==

const isDesktop = window.matchMedia("(min-width: 576px)").matches;

const logger = (msg) => {
    console.log('CM_Offers_UI: ' + msg);
}

const getArticleId = (origArticleElem) => {
    return origArticleElem.id.substr(10);
}

const reversetGetArticleId = (newArticleElem) => {
    return 'articleRow' + newArticleElem.id.substr(21);
}

// Sometimes the title is not in the attribute 'data-bs-original-title' when the page loads
// In those cases the value can be found from the attribute 'title'
const getDataValue = (elem) => {
    if (!elem) return '';

    const dataBsOriginalTitle = elem.getAttribute('data-bs-original-title');
    if (dataBsOriginalTitle) return dataBsOriginalTitle;

    return elem.getAttribute('title');
}

const getImageUrl = (origArticleElem) => {
    const thumbnailIcon = origArticleElem.querySelector('span.thumbnail-icon');

    const dataValue = getDataValue(thumbnailIcon);

    const fileTypes = ['.jpg', '.jpeg', '.png'];
    let fileType;
    let fileTypeIndex = -1;
    for (const fileTypeVal of fileTypes) {
        if (dataValue.indexOf(fileTypeVal) !== -1) {
            fileTypeIndex = dataValue.indexOf(fileTypeVal);
            fileType = fileTypeVal;
            break;
        }
    }

    if (fileTypeIndex === -1) {
        logger('Unhandled filetype in' + dataValue);
        return '';
    }

    return dataValue?.slice(dataValue.indexOf('https'), fileTypeIndex + fileType.length);
}


const extractProductInfo = (origArticleElem) => {
    if (!origArticleElem) {
        return {};
    }

    const articleId = getArticleId(origArticleElem);
    const titleElem = origArticleElem.querySelector('div.col-seller');
    const attributesElem = origArticleElem.querySelector('div.product-attributes');
    const titleParts = titleElem?.innerText.split('(');
    const titleName = titleParts?.[0].trim();
    // e.g. PRE 039
    const description = titleParts?.[1]?.split(')')[0].trim();
    const attributes = [description];
    let scanElem;

    // Set name, rarity, condition, language, [reverse, altered, signed, scan]
    for (const attributeElem of attributesElem?.children) {
        const title = getDataValue(attributeElem);
        if (!title) {
            scanElem = attributeElem;
        } else {
            attributes.push(title);
        }
    }

    const attributesStr = attributes.filter(val => !!val).join(' | ');

    const priceElem = origArticleElem.querySelector('span.text-nowrap');
    const itemCountElem = origArticleElem.querySelector('span.item-count');
    const addToCartForm = origArticleElem.querySelector('form');
    const addToCartFormButton = addToCartForm?.querySelector('button');
    const addToCartSelect = origArticleElem.querySelector(`select#amount${articleId}`);
    const addToCartModalLink = origArticleElem.querySelector("a[href='#']");
    const commentsElem = origArticleElem.querySelector('span.text-truncate');
    const commentsMobileElem = origArticleElem.querySelector('span.fonticon-comments');
    const mobileComments = getDataValue(commentsMobileElem);

    return {
        title: titleName,
        description: description,
        url: titleElem?.children[0].href,
        comments: commentsElem?.innerText || mobileComments, // Text writter by seller
        attributes: attributesStr,
        attributesElem: attributesElem,
        scanElem: scanElem,
        price: priceElem?.innerText,
        amount: itemCountElem?.innerText,
        addToCartForm: addToCartForm,
        addToCartFormButton: addToCartFormButton,
        addToCartSelect: addToCartSelect,
        addToCartModalLink: addToCartModalLink,
    }
}

const createImageElem = (origArticleElem) => {
    const {url: articleUrl} = extractProductInfo(origArticleElem);

    // Extract image from thumbnail
    const imageUrl = getImageUrl(origArticleElem);
    const articleId = getArticleId(origArticleElem);

    // Create a wrapper div for the image
    const imageContainerElem = document.createElement('div');
    imageContainerElem.id = 'CardmarketUI_Image_' + articleId;
    imageContainerElem.style['border-radius'] = '0.3rem';
    imageContainerElem.style.overflow = 'hidden';
    imageContainerElem.style['min-height'] = '50px'; // In case no image

    // Open article in new tab by clicking image
    const linkElem = document.createElement('a');
    linkElem.setAttribute('href', articleUrl);
    linkElem.setAttribute('target', '_blank');

    // Create an element for the image
    const imageElem = document.createElement('img');
    imageElem.onload = () => {
        const isHorizontal = imageElem.width > imageElem.height;
        imageElem.style['aspect-ratio'] = isHorizontal ? '3.5 / 2.5' : '2.5 / 3.5';
    };
    imageElem.setAttribute('src', imageUrl);
    imageElem.style.width = '100%';

    linkElem.append(imageElem);
    imageContainerElem.append(linkElem);

    return imageContainerElem;
}

const addSubmitListener = (newArticleElem, origArticleElem, iframeDocument, retry) => {
    // Close previous system message and try again
    const systemMessage = (iframeDocument || document).querySelector('div.systemMessage');
    if (systemMessage) {
        if (!retry) {
            logger('Close previous system message');
            const closeSystemMessageButton = systemMessage.querySelector('button');
            closeSystemMessageButton.click();
        }

        setTimeout(() => {
            addSubmitListener(newArticleElem, origArticleElem, iframeDocument, true);
        }, 100);

        return;
    }

    // Use interval to wait until success/fail heading appears
    let retries = 0;
    const systemMessageInterval = setInterval(() => {
        if (retries > 10) {
            logger("Failed to get system message");
            clearInterval(systemMessageInterval);
        }
        retries++;
        const systemMessage = (iframeDocument || document).querySelector('div.systemMessage');

        if (!systemMessage) {
            return;
        }

        // Element found, clear interval
        clearInterval(systemMessageInterval);

        if (systemMessage.innerText.trim() === 'Your request was executed successfully') {
            logger('Item added to cart', newArticleElem.id.substr(10));
            // Update styles
            updateArticle(newArticleElem, iframeDocument);
        } else {
            logger('Adding to cart failed ' + systemMessage.innerText);
        }
    }, 200);
};

const createProductHeaderElem = (newArticleElem, origArticleElem) => {
    // Collect data from original element
    const {title, attributes, attributesElem: origAttributesElem, comments} = extractProductInfo(origArticleElem);
    const articleId = getArticleId(origArticleElem);

    const productHeaderElem = document.createElement('div');
    productHeaderElem.id = 'CardmarketUI_ProductHeader_' + articleId;
    productHeaderElem.style.display = 'flex';
    productHeaderElem.style['flex-direction'] = 'column';
    productHeaderElem.style.padding = isDesktop ? '0 0.5rem 0.2rem 0.5rem' : '0.3rem 0.3rem 0 0.3rem';

    const titleElem = document.createElement('span');
    titleElem.id = 'CardmarketUI_ProductTitle_' + articleId;
    titleElem.innerText = title;
    titleElem.classList.add('color-primary');
    titleElem.style['font-weight'] = 'bold';
    titleElem.style['font-size'] = isDesktop ? '1rem' : '0.8rem';
    titleElem.style.overflow = 'hidden';
    titleElem.style['text-overflow'] = 'ellipsis';
    productHeaderElem.append(titleElem);

    const descriptionElem = document.createElement('span');
    descriptionElem.id = 'CardmarketUI_ProductDescription_' + articleId;
    descriptionElem.innerText = attributes;
    descriptionElem.classList.add('color-primary');
    descriptionElem.style['font-size'] = isDesktop ? '0.6rem' : '0.5rem';
    productHeaderElem.append(descriptionElem);

    const attributesElem = document.createElement('div');
    attributesElem.id = 'CardmarketUI_ProductAttributes_' + articleId;
    attributesElem.style.position = 'absolute';
    attributesElem.style['margin-top'] = isDesktop ? '-2rem' : '-2.4rem';
    attributesElem.style['min-height'] = '1.8rem';
    attributesElem.style.right = '0.2rem';
    attributesElem.style.padding = '0.2rem 0.4rem';
    attributesElem.style['background-color'] = 'rgba(0,0,0,0.5)';
    attributesElem.style['border-radius'] = '0.3rem';
    attributesElem.style.display = 'flex';
    attributesElem.style.gap = '0.25rem';
    attributesElem.style['flex-direction'] = 'row';
    attributesElem.style['justify-content'] = 'center';
    attributesElem.style['align-items'] = 'center';

    const commentElem = document.createElement('span');
    commentElem.id = 'CardmarketUI_ProductComment_' + articleId;
    commentElem.innerText = comments;
    commentElem.classList.add('color-primary');
    commentElem.style['margin-top'] = '0.5rem';
    commentElem.style['font-style'] = 'italic';
    commentElem.style['font-size'] = isDesktop ? '0.8rem' : '0.6rem';
    productHeaderElem.append(commentElem);

    const attributeElems = Array.from(origAttributesElem.children).filter((e, i) => {
        // Reset margin, handled by flex
        e.style.cssText += 'margin: 0 !important;';

        if (e.tagName === 'A') {
            // Fix link elem positioning
            e.style.display = 'flex';
        }
        return ![0, 1].includes(i);
    });

    if (attributeElems.length) {
        attributesElem.append(...attributeElems);
        productHeaderElem.append(attributesElem);
    }

    return productHeaderElem;
}

const createProductInfoElem = (newArticleElem, origArticleElem, iframeDocument) => {
    // Collect data from original element
    const {price, amount, addToCartFormButton, addToCartSelect} = extractProductInfo(origArticleElem);
    const articleId = getArticleId(origArticleElem);

    const productInfoElem = document.createElement('div');
    productInfoElem.id = 'CardmarketUI_ProductInfo_' + articleId;
    productInfoElem.style.display = 'flex';
    productInfoElem.style['flex-direction'] = 'row';
    productInfoElem.style['justify-content'] = 'space-between';
    productInfoElem.style['align-items'] = 'center';
    productInfoElem.style['flex-grow'] = '1';
    productInfoElem.style['flex-wrap'] = 'wrap';
    productInfoElem.style.padding = isDesktop ? '0 0.5rem' : '0.3rem 0.3rem 0 0.3rem';

    const priceContainer = document.createElement('span');
    priceContainer.id = 'CardmarketUI_Price_' + articleId;
    priceContainer.innerText = price;
    priceContainer.classList.add('color-primary');
    priceContainer.style['font-size'] = isDesktop ? '1.5rem' : '1.1rem';
    priceContainer.style['font-weight'] = 'bold';
    priceContainer.style['flex-grow'] = '1';
    productInfoElem.append(priceContainer);

    const amountContainer = document.createElement('span');
    amountContainer.id = 'CardmarketUI_Amount_' + articleId;
    amountContainer.innerText = 'x' + amount;
    amountContainer.classList.add('color-primary');
    amountContainer.style['font-size'] = isDesktop ? '1rem' : '0.9rem';
    amountContainer.style['font-weight'] = 'bold';
    amountContainer.style['margin-right'] = addToCartSelect ? '0' : '0.5rem';
    if (!isDesktop) {
        amountContainer.style['line-height'] = '1.1rem';
    }
    productInfoElem.append(amountContainer);

    if (addToCartFormButton && addToCartSelect) {
        const selectElem = document.createElement('select');
        selectElem.id = 'CardmarketUI_Select_' + articleId;
        selectElem.style['margin-right'] = '0.25rem';
        selectElem.style['border-radius'] = '0.2rem';
        selectElem.style.padding = '0.1rem';
        selectElem.style.width = '3rem';
        selectElem.style['flex-grow'] = '1';
        selectElem.style.color = 'white';
        selectElem.onchange = (elem) => {
            addToCartSelect.value = elem.target.value;
            addToCartSelect.dispatchEvent(new Event('change'));
        };

        const selectValues = [...addToCartSelect.children].map(optionElem => ({value: optionElem.value}));
        const selectElems = selectValues.map(({value}) => {
            const optionElem = document.createElement('option');
            optionElem.value = value;
            optionElem.innerText = value;
            selectElem.append(optionElem);
        });
        productInfoElem.append(selectElem);
    }

    if (addToCartFormButton) {
        const addToCartButtonElem = document.createElement('button');
        addToCartButtonElem.id = 'CardmarketUI_AddToCartButton_' + articleId;
        addToCartButtonElem.classList.add('fonticon-cart');
        addToCartButtonElem.classList.add('btn-primary');
        addToCartButtonElem.style.border = 'none';
        addToCartButtonElem.style.padding = '0.3rem';
        addToCartButtonElem.style['border-radius'] = '0.3rem';
        addToCartButtonElem.onclick = () => {
            addSubmitListener(newArticleElem, origArticleElem, iframeDocument);
            addToCartFormButton.click();
        }
        productInfoElem.append(addToCartButtonElem);
    }

    return productInfoElem;
}


const createArticle = (origArticleElem, iframeDocument) => {
    // Create a new article
    const newArticleElem = document.createElement('div');
    newArticleElem.id = 'CardmarketUI_Article_' + getArticleId(origArticleElem);
    newArticleElem.classList.add('card');
    newArticleElem.style.display = 'flex';
    newArticleElem.style['flex-direction'] = 'column';
    newArticleElem.style.width = isDesktop ? '14rem' : '30vw'; // Mobile: 3 items per row
    newArticleElem.style['padding-bottom'] = '0.3rem';
    newArticleElem.style.position = 'relative';

    const imageElem = createImageElem(origArticleElem);
    newArticleElem.append(imageElem);

    const productHeaderElem = createProductHeaderElem(newArticleElem, origArticleElem);
    newArticleElem.append(productHeaderElem);

    const productInfoElem = createProductInfoElem(newArticleElem, origArticleElem, iframeDocument);
    newArticleElem.append(productInfoElem);

    return newArticleElem;
}

const hideOrigUIElements = () => {
    // Hide original table
    const tableBodyElem = document.querySelector('div.table-body');
    tableBodyElem.style.cssText += 'display: none !important;';

    // Hide table header (only visible if search has results)
    const tableHeader = document.querySelector('div.table-header');
    if (tableHeader) {
        tableHeader.style.cssText += 'display: none !important;';
    }

    // Hide buy multiple button (only visible if logged in)
    const buyAllForm = document.querySelector('form#BuyAllForm');
    if (buyAllForm) {
        buyAllForm.style.cssText += 'display: none !important;';
    }

    // Fix style override in table
    const userOffersTable = document.querySelector('div#UserOffersTable');
    if (userOffersTable) {
        userOffersTable.classList.remove('table');
    }

    // Hide scan tooltip on mobile since you can't really hover
    if (!isDesktop) {
        GM.addStyle(`
           div.bs-tooltip-auto {
              display: none !important;
           }
        `);
    }
};

const createNewTable = () => {
    const userOffersTable = document.querySelector('div#UserOffersTable');

    // Create a new table
    const newTableBody = document.createElement('div');
    newTableBody.id = 'CardmarketUI_Table';
    newTableBody.style.display = 'flex';
    newTableBody.style['flex-wrap'] = 'wrap';
    newTableBody.style['justify-content'] = isDesktop ? 'center' : 'flex-start';
    newTableBody.style.gap = isDesktop ? '1rem 0.5rem' : '1rem 2vw';
    newTableBody.style.padding = isDesktop ? '0.8rem' : '';

    // Add new table in place of old one
    userOffersTable.append(newTableBody);

    return newTableBody;
}

const updateArticle = (newArticleElem, iframeDocument) => {
    const tableElem = document.querySelector('div#CardmarketUI_Table');

    const origArticleId = reversetGetArticleId(newArticleElem);
    const origArticleElem = (iframeDocument || document).querySelector('div#' + origArticleId);

    if (!origArticleElem) {
        // Element no longer exists, remove from table
        tableElem.removeChild(newArticleElem);
        logger("Article ran out");
        return;
    }

    // Update item to table
    const updatedNewArticleElem = createArticle(origArticleElem, iframeDocument);
    tableElem.replaceChild(updatedNewArticleElem, newArticleElem);
    logger("Article updated");
}

const convertArticles = (newTableBody, articleElems, iframeDocument) => {
    for (const origArticleElem of articleElems) {
        const newArticleElem = createArticle(origArticleElem, iframeDocument);

        newTableBody.append(newArticleElem);
    }
};

const handleIframeLoaded = (pageNumber) => {
    const iframeElem = document.querySelector('iframe#CM_Offers_Feed_Page_' + pageNumber);

    const iframeDocument = iframeElem.contentWindow.document;
    const articleElems = iframeDocument.querySelectorAll('div.article-row');
    if (!articleElems) return;

    const tableElem = document.querySelector('div#CardmarketUI_Table');

    logger('Found articles from iframe for page ' + pageNumber);

    convertArticles(tableElem, articleElems, iframeDocument);
}

const addIframeReadyListener = () => {
    window.addEventListener ("message", (msg) => {
        if (!msg?.data) return;
        const [scriptName, event, pageNumber] = msg.data.split(':');
        if (scriptName === 'CM_Offers_Feed' && event === 'loaded' && pageNumber) {
            handleIframeLoaded(pageNumber);
        }
    }, false);
};

(function() {
    'use strict';

    // Don't run the script again in iframe
    if (window.self !== window.top) return;

    logger("Initialised");
    window.top.postMessage(`CM_Offers_UI:initialised`, '*');

    hideOrigUIElements();
    const newTableBody = createNewTable();
    const articleElems = document.querySelectorAll('div.article-row');
    convertArticles(newTableBody, articleElems);

    addIframeReadyListener();
})();
