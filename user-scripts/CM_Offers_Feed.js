// ==UserScript==
// @name         CM_Offers_Feed
// @description  Load more Cardmarket Offers pages without needing to reload page
// @version      1.0.1
// @author       Topi Salonen
// @namespace    https://topi.dev/
// @match        https://www.cardmarket.com/*/Offers/*
// @icon         data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔗</text></svg>
// ==/UserScript==

const state = {
    currentPage: 0,
    totalPages: 0,
    totalItems: 0,
    pagesLoaded: 1,
    loadingPages: {},
};

const parsePaginationValues = () => {
    const elem = document.querySelector('div.pagination');

    if (!elem) return {items: 0, currentPage: 0, totalPages: 0};

    const items = elem.children[0].innerText.split(/(\s)/);
    const pages = elem.children[1].innerText.split(/(\s)/);
    const [pageNumber, splitPageNumber] = pages[6].split('+');
    const [itemNumber, _] = items[0].split('+');

    state.totalPages = Number(pageNumber);
    state.currentPage = Number(pages[2]);
    state.totalItems = Number(itemNumber);
    state.hasMorePages = splitPageNumber !== undefined;
};

const getPageUrl = (pageNumber) => {
    const url = new URL(window.location);
    url.searchParams.set('site', pageNumber);

    return url.href;
};

const createPageIframe = (pageNumber) => {
    const pageUrl = getPageUrl(pageNumber);

    const iframeElem = document.createElement('iframe');
    iframeElem.id = 'CM_Offers_Feed_Page_' + pageNumber;
    iframeElem.src = pageUrl;
    iframeElem.style.display = 'none';

    document.body.append(iframeElem);

    return iframeElem;
};

const setIframeLoading = (pageNumber) => {
    // Set loading
    state.loadingPages = {
        ...state.loadingPages,
        [pageNumber]: true,
    };

    const feedSpinnerElem = document.querySelector('div#CM_Feed_Spinner');
    feedSpinnerElem.style.transition = 'transform 20s linear';
    feedSpinnerElem.style.transform = 'rotate(18000deg)';
};

const setIframeLoaded = (iframeElem, isLoaded, pageNumber) => {
    // Unset loading
    state.loadingPages = {
        ...state.loadingPages,
        [pageNumber]: false,
    };
    state.pagesLoaded = pageNumber;

    const feedSpinnerElem = document.querySelector('div#CM_Feed_Spinner');
    feedSpinnerElem.style.transition = 'none';
    feedSpinnerElem.style.transform = 'rotate(0deg)';

    iframeElem.setAttribute('isLoaded', isLoaded);
};

const hideSpinner = () => {
    const feedSpinnerElem = document.querySelector('div#CM_Feed_Spinner');
    feedSpinnerElem.style.display = 'none';
};

const handleIframeLoaded = async (iframeElem) => {
    return new Promise((resolve) => {
        let intervalCalls = 0;
        const loadCheckInterval = setInterval(() => {
            intervalCalls++;

            if (intervalCalls > 20) {
                console.warn("CM_Offers: Iframe interval limit reached before page loaded");
                clearInterval(loadCheckInterval);
                resolve(false);
                return;
            }

            // Check if iframe has body
            const iframeDocument = iframeElem.contentWindow?.document?.body;
            if (!iframeDocument) return;

            // Check if offers table is rendered
            const offersTable = iframeDocument.querySelector('div#UserOffersTable');
            if (!offersTable) return;

            clearInterval(loadCheckInterval);
            resolve(true);
        }, 500);
    })
};

const loadPageInIframe = async (pageNumber) => {
    // Already loading page
    if (state.loadingPages[pageNumber]) {
        console.warn(`CM_Offers_Feed: Already loading page ${pageNumber}`);
        return;
    }

    // Start loading page in iframe
    setIframeLoading(pageNumber);
    const iframeElem = createPageIframe(pageNumber);
    const isLoaded = await handleIframeLoaded(iframeElem);
    setIframeLoaded(iframeElem, isLoaded, pageNumber);

    if (!isLoaded) {
        console.error(`CM_Offers_Feed: Failed to load articles from page ${pageNumber}`);
        return;
    }

    window.top.postMessage(`CM_Offers_Feed:loaded:${pageNumber}`, '*');
};

const hideDefaultPagination = () => {
    // Hide children of pagination elements so new elements can be appended
    const paginationElems = document.querySelectorAll('div.pagination');
    [...paginationElems[0].children].forEach(elem => {
        elem.style.cssText += 'display: none !important;'
    });
    [...paginationElems[1].children].forEach(elem => {
        elem.style.cssText += 'display: none !important;'
    });
};

const setLoadOnScrollPagination = () => {
    hideDefaultPagination();

    if (state.totalPages === state.currentPage) return;

    // Create a spinner element
    const feedSpinnerElem = document.createElement('div');
    feedSpinnerElem.id = 'CM_Feed_Spinner';
    feedSpinnerElem.style['margin-top'] = '3rem';
    feedSpinnerElem.style.width = '3rem';
    feedSpinnerElem.style.height = '3rem';
    feedSpinnerElem.style.border = '0.2rem solid var(--bs-primary)';
    feedSpinnerElem.style['border-top-color'] = 'transparent';
    feedSpinnerElem.style['border-radius'] = '50%';

    // Append spinner to bottom pagination
    const paginationElems = document.querySelectorAll('div.pagination');
    paginationElems[1].style['justify-content'] = 'center';
    paginationElems[1].append(feedSpinnerElem);
};

const loadNextOffersPage = () => {
    const {totalPages} = state;

    if (totalPages > state.pagesLoaded) {
        const nextPage = state.pagesLoaded + 1;
        if (!state.loadingPages[nextPage]) {
            console.log(`CM_Offers_Feed: Start loading page ${nextPage}`);
            loadPageInIframe(nextPage)
                .then(() => {
                    console.log(`CM_Offers_Feed: Loaded page ${nextPage}`)
                });
        }

        return;
    }

    // All pages loaded
    document.removeEventListener("scroll", handleOnScroll);
    hideSpinner();
}

const handleOnScroll = () => {
    const uiTable = document.querySelector('div#CardmarketUI_Table');
    const lastChild = [...uiTable.children].pop();
    const rect = lastChild.getBoundingClientRect();
    const shouldStartLoadingNextPage = (rect.y - (rect.height * 3)) < 0;

    if (shouldStartLoadingNextPage) {
        loadNextOffersPage();
    }
};

const addScrollListener = () => {
    document.addEventListener("scroll", handleOnScroll);
}

const handleOffersUIInitialised = (msg) => {
    const [scriptName, event] = msg?.data?.split(':');
    if (scriptName === 'CM_Offers_UI' && event === 'initialised') {
        console.log('CM_Offers_Feed: Initialised');
        parsePaginationValues();

        (async () => {
            setLoadOnScrollPagination();
            addScrollListener();
        })();
    }
};

(async () => {
    'use strict';

    // Don't run the script again in iframe
    if (window.self !== window.top) return;

    // Wait for CM_Offers_UI to be ready, the feed won't work without it
    window.addEventListener('message', handleOffersUIInitialised, false);
})();
