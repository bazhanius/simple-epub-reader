/* jshint esversion: 6 */

function ready() {

    const loadingStates = {
        'ready': 0,
        'loading': 1,
        'completed': 2,
        'error': 3
    };

    let loadingState = loadingStates.ready;

    let tourCompleted = localStorage.getItem("s-e-r_tour-completed") || null;

    let next = document.getElementById("next");
    next.addEventListener("click", function (e) {
        rendition.next();
        e.preventDefault();
    }, false);

    let prev = document.getElementById("prev");
    prev.addEventListener("click", function (e) {
        rendition.prev();
        e.preventDefault();
    }, false);

    let loader = document.querySelector("#loader-overlay");
    let loadingProgress = document.querySelector(".loading-progress");

    let readingTips = document.querySelector(".reading-tips");
    let readingTipsClose = document.querySelector("#reading-tips-close");
    let readBookButton = document.querySelector("#read-book-button");

    if (tourCompleted === "true") {
        readingTips.style.display = 'none';
    } else {
        readingTips.style.display = 'flex';
    }

    let locGeneratedIntervalID = null;
    let locGenerateStartTime = null;

    const loadStart = () => {
        loadingState = loadingStates.loading;
        locGenerateStartTime = new Date();
        readBookButton.disabled = true;
        let loaderIcon = loadingProgress.querySelectorAll('svg');
        let loaderBlocks = loadingProgress.querySelectorAll('div');
        loaderIcon[0].style.display = 'block';
        loaderIcon[1].style.display = 'none';
        loaderIcon[2].style.display = 'none';

        loaderBlocks[1].innerHTML = 'Opening the book...';
        locGeneratedIntervalID = setInterval(function () {
                if (loadingState !== loadingStates.loading) {
                    clearInterval(locGeneratedIntervalID);
                } else {
                    let cur = book.locations.generated;
                    let total = book.locations.spine.length;
                    let diff = (new Date() - locGenerateStartTime) / 1000;
                    let proportion = cur / total;
                    loaderIcon[0].querySelectorAll('circle')[1].style.strokeDasharray = `${proportion * 2 * Math.PI * 11.5} ${2 * Math.PI * 11.5}`;
                    //document.documentElement.style.setProperty("--loading-value", "'" + (proportion * 2 * Math.PI * 18).toFixed(0) + "'");
                    let remaining = ((1 - proportion) * diff / (proportion)).toFixed(0);
                    if (cur && total && diff > 2) {
                        loaderBlocks[1].innerHTML = `Opening the book...<span class="book-example-author">${(proportion * 100).toFixed(0)}% — About ${remaining}s remaining</span>`;
                    }
                }
            }, 250
        );
    };

    const loadCompleted = () => {
        loadingState = loadingStates.completed;
        clearInterval(locGeneratedIntervalID);
        let loaderIcon = loadingProgress.querySelectorAll('svg');
        let loaderBlocks = loadingProgress.querySelectorAll('div');
        loaderIcon[0].style.display = 'none';
        loaderIcon[1].style.display = 'block';
        loaderIcon[2].style.display = 'none';
        loaderBlocks[1].innerHTML = `The book is ready!`
        readBookButton.disabled = false;
    };

    const loadFailed = () => {
        loadingState = loadingStates.error;
        clearInterval(locGeneratedIntervalID);
        let loaderIcon = loadingProgress.querySelectorAll('svg');
        let loaderBlocks = loadingProgress.querySelectorAll('div');
        loaderIcon[0].style.display = 'none';
        loaderIcon[1].style.display = 'none';
        loaderIcon[2].style.display = 'block';
        loaderBlocks[1].innerHTML = `Error opening book file:<br />${bookFile}`;
        loader.style.display = 'flex';
        console.warn(`Error opening book file: ${bookFile}`);
        let div = document.createElement("div");
        let close = document.createElement("button");
        close.innerHTML = 'Step back';
        close.onclick = function (e) {
            //window.parent.postMessage("close", "*");
            window.location.href = document.location.href.split('?')[0];
        };
        div.appendChild(close);
        loader.appendChild(div);
        readBookButton.disabled = true;
    };

    readingTipsClose.addEventListener("click", (e) => {
        readingTips.style.display = 'none';
        localStorage.setItem("s-e-r_tour-completed", "true");
    });

    readBookButton.addEventListener("click", (e) => {
        loader.style.display = 'none';
    });

    const openBook = () => {

        if (loadingState !== loadingStates.loading) {
            loadStart();
        }

        let rendition = book.renderTo("viewer", {
            //manager: "default", // default / continuous
            flow: "paginated",  // paginated / scrolled / auto
            spread: "never", // never or always
            minSpreadWidth: 1024,
            layout: "reflowable", // reflowable or pre-paginated
            width: "100%",
            height: "100%",
            //snap: true,
            resizeOnOrientationChange: true,
            allowScriptedContent: true
        });
        let displayed = rendition.display();

        const makeRangeCfi = (a, b) => {
            const CFI = new ePub.CFI()
            const start = CFI.parse(a), end = CFI.parse(b)
            const cfi = {
                range: true,
                base: start.base,
                path: {
                    steps: [],
                    terminal: null
                },
                start: start.path,
                end: end.path
            }
            const len = cfi.start.steps.length
            for (let i = 0; i < len; i++) {
                if (CFI.equalStep(cfi.start.steps[i], cfi.end.steps[i])) {
                    if (i === len - 1) {
                        // Last step is equal, check terminals
                        if (cfi.start.terminal === cfi.end.terminal) {
                            // CFI's are equal
                            cfi.path.steps.push(cfi.start.steps[i])
                            // Not a range
                            cfi.range = false
                        }
                    } else cfi.path.steps.push(cfi.start.steps[i])
                } else break
            }
            cfi.start.steps = cfi.start.steps.slice(cfi.path.steps.length)
            cfi.end.steps = cfi.end.steps.slice(cfi.path.steps.length)

            return 'epubcfi(' + CFI.segmentString(cfi.base)
                + '!' + CFI.segmentString(cfi.path)
                + ',' + CFI.segmentString(cfi.start)
                + ',' + CFI.segmentString(cfi.end)
                + ')'
        }

        let jumpSuggester = document.querySelector('#jump-suggester');
        let jumpSuggesterClose = document.querySelector('#jump-suggester-close');
        let jumped = false;

        jumpSuggesterClose.addEventListener("click", (e) => {
            jumpSuggester.style.display = 'none';
        })
        const jumpController = () => {
            jumped = false;
            if (locationHistory.length > 2) {
                let back = jumpSuggester.querySelector('#jump-suggester-return');
                back.innerHTML = "Back to location " + locationHistory[1].page;
                back.onclick = function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    rendition.display(locationHistory[1].start.cfi);
                    jumpSuggester.style.display = 'none';
                };
                jumpSuggester.style.display = 'flex';
            }
        }

        let bookmarks = JSON.parse(localStorage.getItem("s-e-r_bookmarks-" + bookFileName)) || [];

        let bookmarksAddDeleteButton = document.querySelector("#bookmarks-add-delete-button");
        let bookmarksClearButton = document.querySelector("#bookmarks-clear-button");
        let bookmarksListTable = document.querySelector("#bookmarks-list-table");

        bookmarksClearButton.addEventListener("click", (e) => {
            bookmarksListTable.innerHTML = '';
            bookmarks = [];
            localStorage.removeItem("s-e-r_bookmarks-" + bookFileName);
            updateBookmarksAddDeleteButtonState();
        })

        bookmarksAddDeleteButton.addEventListener("click", (e) => {
            let currentLocation = rendition.currentLocation();
            currentLocation.chapter = currentChapter.textContent;
            currentLocation.page = currentPage[0].textContent;
            currentLocation.time = (new Date()).toLocaleString();

            const [a, b] = [currentLocation.start.cfi, currentLocation.end.cfi]
            book.getRange(makeRangeCfi(a, b)).then(range => {
                currentLocation.text = range.toString().substring(0, 128) + "…";
                updateBookmarks();
            })

            let duplicateIndex = bookmarks.findIndex(b => b.page === currentLocation.page
                && b.start.cfi === currentLocation.start.cfi);

            if (duplicateIndex === -1) {
                bookmarks.unshift(currentLocation);
            } else {
                bookmarks.splice(duplicateIndex, 1);
            }
            updateBookmarks();
        })

        const updateBookmarksAddDeleteButtonState = () => {
            let currentLocation = rendition.currentLocation();
            currentLocation.page = currentPage[0].textContent;

            let duplicateIndex = bookmarks.findIndex(b => b.page === currentLocation.page
                && b.start.cfi === currentLocation.start.cfi);

            let button = bookmarksAddDeleteButton.querySelectorAll('div');
            if (duplicateIndex === -1) {
                button[0].innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="var(--text)"><path d="M240-180v-567.31q0-22.46 16.16-38.92 16.17-16.46 39.22-16.46h238.47v30.77H295.38q-9.23 0-16.92 7.69-7.69 7.69-7.69 16.92v519.39L480-317.08l209.23 89.16v-304H720V-180L480-283.08 240-180Zm30.77-591.92h263.08-263.08Zm418.46 169.23v-84.62h-84.61v-30.77h84.61v-84.61H720v84.61h84.62v30.77H720v84.62h-30.77Z"/></svg>';
                button[1].innerHTML = 'Add current page to bookmarks';
            } else {
                button[0].innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="var(--text)"><path d="M804.62-687.31h-200v-30.77h200v30.77ZM240-180v-567.31q0-22.46 16.16-38.92 16.17-16.46 39.22-16.46h238.47v30.77H295.38q-9.23 0-16.92 7.69-7.69 7.69-7.69 16.92v519.39L480-317.08l209.23 89.16v-304H720V-180L480-283.08 240-180Zm30.77-591.92h263.08-263.08Z"/></svg>'
                button[1].innerHTML = 'Delete current page from bookmarks';
            }
        }
        const updateBookmarks = () => {
            bookmarksListTable.innerHTML = '';
            if (bookmarks.length > 0) {
                let h = generateHTML('bookmarks', bookmarks);
                bookmarksListTable.appendChild(h);
                localStorage.setItem("s-e-r_bookmarks-" + bookFileName, JSON.stringify(bookmarks));
            } else {
                localStorage.removeItem("s-e-r_bookmarks-" + bookFileName);
            }
            updateBookmarksAddDeleteButtonState();
        }


        const highlightWord = (text, val) => {
            if (!val) return text;
            let index = text.toLowerCase().indexOf(val.toLowerCase());
            if (index > -1) {
                return `${text.substring(0, index)}<span class="highlight-text">${text.substring(index, index + val.length)}</span>${text.substring(index + val.length)}`;
            } else {
                return text;
            }
        }

        let searchBookButton = document.querySelector("#search-book-button");
        let resetSearchBookButton = document.querySelector("#reset-search-book-button");
        let searchBookInput = document.querySelector("#search-book-input");
        let searchBookSelect = document.querySelector("#search-diapason");
        let searchResultSummary = document.querySelector("#search-result-summary");
        let searchResultList = document.querySelector("#search-result-list");

        let lastSearchResults;

        const resetSearchResults = () => {
            searchBookButton.disabled = true;
            resetSearchBookButton.disabled = true;
            searchResultSummary.style.display = 'none';
            searchResultList.innerHTML = '';
            searchBookInput.value = '';
            if (lastSearchResults && lastSearchResults.length > 0) {
                lastSearchResults.forEach(r => {
                    rendition.annotations.remove(r.cfi, "highlight");
                })
            }
        }


        resetSearchBookButton.addEventListener('click', (e) => {
            resetSearchResults();
        }, false)


        const searchBook = () => {
            searchResultSummary.style.display = 'none';
            searchResultList.innerHTML = '';

            let query = searchBookInput.value;
            let diapason = searchBookSelect.value;
            if (query.length < 3) return;

            const parseResult = (result) => {
                if (lastSearchResults && lastSearchResults.length > 0) {
                    lastSearchResults.forEach(r => {
                        rendition.annotations.remove(r.cfi, "highlight");
                    })
                }
                lastSearchResults = result;
                if (result.length > 0) {
                    resetSearchBookButton.disabled = false;
                } else {
                    resetSearchBookButton.disabled = true;
                }
                searchResultSummary.querySelector('span').innerHTML = 'Found: ' + result.length;
                searchResultSummary.style.display = 'flex';

                result.forEach(r => {
                    rendition.annotations.add("highlight", r.cfi, {}, null, null, {
                        "fill": "yellow",
                        "fill-opacity": "0.3",
                        "mix-blend-mode": "multiply"
                    }); // "highlight", "underline", "mark"
                });

                let html = generateHTML('search', result, query);
                searchResultList.appendChild(html);
            }

            if (diapason === "chapter") {
                doChapterSearch(query).then(result => {
                    parseResult(result);
                });
            }

            if (diapason === "book") {
                doSearch(query).then(result => {
                    parseResult(result);
                });
            }
        }

        searchBookInput.addEventListener("input", (e) => {
            let val = e.target.value;
            if (lastSearchResults && lastSearchResults.length > 0) {
                resetSearchBookButton.disabled = false;
            } else {
                resetSearchBookButton.disabled = true;
            }
            if (!val || val.length < 3) {
                searchBookButton.disabled = true;
                return;
            }
            searchBookButton.disabled = false;
        })
        searchBookInput.addEventListener("keyup", (e) => {
            if (e.keyCode === 13 || e.key === 'Enter' || e.code === 'Enter') {
                searchBook();
            }
        })
        searchBookButton.addEventListener("click", searchBook);


        let historyTabs = document.querySelectorAll(".history-tab-links");
        let historyTabsContent = document.querySelectorAll(".history-tab-content");

        let appearanceTabs = document.querySelectorAll(".appearance-tab-links");
        let appearanceTabsContent = document.querySelectorAll(".appearance-tab-content");
        let appearanceSettings = document.querySelectorAll("fieldset");

        appearanceSettings.forEach(s => s.addEventListener("change", notify, false));

        function notify(event) {
            if (event.target !== event.currentTarget) {
                let id = event.target.id;
                let checked = event.target.checked;
                let value = event.target.value;
                if (id) applyTheme(id, checked, value);
            }
            event.stopPropagation();
        }

        function openAppearanceTab(e, name = null) {
            let tabName = e?.target?.id || name;
            if (tabName) {
                appearanceTabsContent.forEach(c => c.style.display = 'none');
                appearanceTabs.forEach(t => t.classList.remove('active'));
                let currentTab = document.querySelector('#' + tabName);
                currentTab.classList.add('active');
                let currentTabContent = document.querySelector('#' + tabName.split('-')[0]);
                currentTabContent.style.display = "block";
            }
        }

        const openHistoryTab = (e, name = null) => {
            let tabName = e?.target?.id || name;
            if (tabName) {
                historyTabsContent.forEach(c => c.style.display = 'none');
                historyTabs.forEach(t => t.classList.remove('active'));
                let currentTab = document.querySelector('#' + tabName);
                currentTab.classList.add('active');
                let currentTabContent = document.querySelector('#' + tabName.split('-')[0]);
                currentTabContent.style.display = "block";
            }
        }

        historyTabs.forEach(t => {
            t.addEventListener('click', openHistoryTab, false);
        })

        appearanceTabs.forEach(t => {
            t.addEventListener('click', openAppearanceTab, false);
        })

        openAppearanceTab(null, 'fonts-tab');
        openHistoryTab(null, 'bookmarks-tab');


        let title = document.getElementById("title");
        let author = document.getElementById("author");
        let cover = document.getElementById("cover");

        let currentPage = document.querySelectorAll(".current-page");
        let totalPages = document.querySelectorAll(".total-pages");

        rendition.on('displayError', (err) => {
            console.log(err);
        })

        let touchStart = null;
        let touchStartTime = null;
        let touchEnd = null;
        let touchEndTime = null;
        const processingClick = (pageX) => {
            let wrapper = rendition.manager.container;
            let grid = wrapper.clientWidth / 4;
            let x = pageX - wrapper.scrollLeft;
            if (x < grid) {
                rendition.prev();
            } else if (x > (grid * 3)) {
                rendition.next();
            } else {
                toggleMenu();
            }
        }

        const handleInputEvent = (e) => {
            try {
                let txt = e.target.textContent;
                if (txt.startsWith('[') && txt.slice(-1) === ']') {
                    jumped = true;
                    return;
                }
                if (e.target.tagName.toLowerCase() === "a" && e.target.href || e.target.parentNode.tagName.toLowerCase() === "a" && e.target.parentNode.href) {
                    jumpSuggester.style.display = 'none';
                    return;
                }
            } catch (err) {
                //console.log(err);
            }

            if (e.type === 'click') {
                processingClick(e.pageX);
            }
            if (e.type === 'touchstart') {
                //e.stopPropagation();
                //e.preventDefault();
                touchStart = e.changedTouches[0];
                touchStartTime = new Date().getTime();
            }
            if (e.type === 'touchend') {
                let wrapper = rendition.manager.container;
                touchEnd = e.changedTouches[0];
                touchEndTime = new Date().getTime();

                let hr = (touchEnd.screenX - touchStart.screenX) / wrapper.getBoundingClientRect().width;
                let vr = (touchEnd.screenY - touchStart.screenY) / wrapper.getBoundingClientRect().height;

                // длительность нажатия менее 250мс (только короткое нажатие, не длительное нажатие)
                if (hr === vr && (touchEndTime - touchStartTime) < 250) {
                    processingClick(touchEnd.pageX);
                } else {
                    if (hr > vr && hr > 0.25) rendition.prev();
                    if (hr < vr && hr < -0.25) rendition.next();
                    if (vr > hr && vr > 0.25) toggleMenu();
                    if (vr < hr && vr < -0.25) toggleMenu();
                }
            }
        }

        const clickType = (('ontouchstart' in window) || (navigator.MaxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0))
            ? 'touch'
            : 'click';

        if (clickType === 'click') {
            rendition.on("click", handleInputEvent);
        } else {
            rendition.on("touchstart", handleInputEvent);
            rendition.on("touchend", handleInputEvent);
        }

        document.body.addEventListener("keyup", function (e) {
            if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') {
                rendition.prev();
            }
            if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
                rendition.next();
            }
        }, false);

        let menuLayer = document.getElementById("menu");
        let menuPanelFiller = document.getElementById("menu-panel-filler");

        let backToLib = document.getElementById("back-to-lib");
        let tocButton = document.getElementById("toc-button");
        let tocLayer = document.getElementById("toc-layer");
        let tocCloseButton = document.getElementById("toc-close");

        let appearanceButton = document.getElementById("appearance-button");
        let appearanceLayer = document.getElementById("appearance-layer");
        let appearanceCloseButton = document.getElementById("appearance-close");

        let searchButton = document.getElementById("search-button");
        let searchLayer = document.getElementById("search-layer");
        let searchCloseButton = document.getElementById("search-close");

        let bookmarksButton = document.getElementById("bookmarks-button");
        let bookmarksLayer = document.getElementById("bookmarks-layer");
        let bookmarksCloseButton = document.getElementById("bookmarks-close");


        let appearanceTabFontIncrease = document.getElementById("font-size-increase");
        let appearanceTabFontDecrease = document.getElementById("font-size-decrease");

        let fontSizeRange = document.querySelector('#font-size_range');

        let moreAppearanceReset = document.querySelector('#more-appearance-reset');
        let moreAppearanceResetBook = document.querySelector('#more-appearance-reset-book');
        let localStorageOccupiedSpace = document.querySelector('.local-storage-occupied-space')

        moreAppearanceReset.addEventListener('click', (e) => {
            applyTheme(null, null, null, true);
        }, false);

        function formatBytes(bytes, decimals = 2) {
            if (!+bytes) return '0 Bytes'

            const k = 1024
            const dm = decimals < 0 ? 0 : decimals
            const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

            const i = Math.floor(Math.log(bytes) / Math.log(k))

            return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
        }

        const updateLocalStorage = () => {
            let lsOccupiedBytes = 0;
            let lsOccupiedPercent = 0;
            Object.keys(localStorage).filter((x) => x.startsWith('s-e-r_')).forEach((x) => {
                lsOccupiedBytes += JSON.stringify(localStorage.getItem(x)).length;
            });
            lsOccupiedPercent = parseInt((lsOccupiedBytes / (1024 * 1024 * 5) * 100).toFixed(0));
            if (lsOccupiedBytes === 0) {
                moreAppearanceResetBook.disabled = true;
                localStorageOccupiedSpace.innerHTML = '';
            } else {
                moreAppearanceResetBook.disabled = false;
                localStorageOccupiedSpace.innerHTML = `${formatBytes(lsOccupiedBytes)} of ${formatBytes(1024 * 1024 * 5)} (${lsOccupiedPercent}%)`;
            }

            // Cleaning up storage when space is running low
            if (lsOccupiedPercent > 90) {
                Object.keys(localStorage).filter((x) => x.startsWith('s-e-r_locations-')).forEach((x) => {
                    // Ignore current book
                    if (!x.startsWith(`s-e-r_locations-${bookFileName}`)) {
                        localStorage.removeItem(x);
                    }
                });
            }
        }

        moreAppearanceResetBook.addEventListener('click', (e) => {
            Object.keys(localStorage).filter((x) => x.startsWith('s-e-r_')).forEach((x) => {
                if (!x.startsWith(`s-e-r_locations-${bookFileName}`)) {
                    localStorage.removeItem(x);
                }
            });
            updateLocalStorage();
            applyTheme(null, null, null, true);
        }, false);

        appearanceTabFontIncrease.addEventListener('click', (e) => {
            if (parseInt(fontSizeRange.value) < parseInt(fontSizeRange.max)) {
                let newVal = parseInt(fontSizeRange.value) + 1;
                fontSizeRange.value = newVal;
                applyTheme('font-size', null, newVal);
            }
        }, false);
        appearanceTabFontDecrease.addEventListener('click', (e) => {
            if (parseInt(fontSizeRange.value) > parseInt(fontSizeRange.min)) {
                let newVal = parseInt(fontSizeRange.value) - 1;
                fontSizeRange.value = newVal;
                applyTheme('font-size', null, newVal);
            }
        }, false);

        let aboutLayer = document.getElementById("about-layer");
        let aboutButton = document.getElementById("about-button");
        let aboutCloseButton = document.getElementById("about-close");

        const toggleAbout = () => {
            aboutLayer.style.display = aboutLayer.style.display === 'flex' ? 'none' : 'flex';
        }

        const toggleBookmarks = () => {
            if (bookmarksLayer.style.display === 'flex') {
                bookmarksLayer.style.display = 'none';
            } else {
                bookmarksLayer.style.display = 'flex';
                updateBookmarks();
            }
        }

        const toggleSearch = () => {
            if (searchLayer.style.display === 'flex') {
                searchLayer.style.display = 'none';
            } else {
                searchLayer.style.display = 'flex';
                searchBookInput.focus();
            }
        }

        const toggleMenu = (log = null) => {
            if (menuLayer.style.display === 'flex') {
                menuLayer.style.display = 'none';
                menuLayer.style.zIndex = '-1';
                menuLayer.classList.add('menu-hidden')
                menuPanelFiller.removeEventListener("click", toggleMenu, false);
            } else {
                menuLayer.style.display = 'flex';
                menuLayer.style.zIndex = '100';
                menuLayer.classList.remove('menu-hidden')
                setTimeout(() => {
                    menuPanelFiller.addEventListener("click", toggleMenu, false);
                }, 500);
            }
        }
        const toggleToc = () => {
            if (tocLayer.style.display === 'flex') {
                tocLayer.style.display = 'none';
            } else {
                tocLayer.style.display = 'flex';
            }
        }
        const toggleAppearance = () => {
            if (appearanceLayer.style.display === 'flex') {
                appearanceLayer.style.display = 'none';
            } else {
                appearanceLayer.style.display = 'flex';
            }
        }

        searchButton.addEventListener("click", function () {
            toggleMenu();
            toggleSearch();
        }, false);

        bookmarksButton.addEventListener("click", function () {
            toggleMenu();
            toggleBookmarks();
        }, false);

        aboutButton.addEventListener("click", function () {
            toggleMenu();
            toggleAbout();
        }, false);

        appearanceButton.addEventListener("click", function () {
            toggleMenu();
            toggleAppearance();
        }, false);


        backToLib.addEventListener("click", function () {
            // If reader opened in iFrame
            // window.parent.postMessage("close", "*");
            window.location.href = document.location.href.split('?')[0];
            book.destroy();
        })
        tocButton.addEventListener("click", function () {
            toggleMenu();
            toggleToc();
            document.querySelector(".active-chapter").scrollIntoView();
        }, false);

        searchCloseButton.addEventListener("click", function () {
            toggleSearch();
        }, false);

        bookmarksCloseButton.addEventListener("click", function () {
            toggleBookmarks();
        }, false);

        tocCloseButton.addEventListener("click", function () {
            toggleToc();
        }, false);

        appearanceCloseButton.addEventListener("click", function () {
            toggleAppearance();
        }, false);

        aboutCloseButton.addEventListener("click", function () {
            toggleAbout();
        }, false);


        // Поиск по всей книге
        const doSearch = (q) => {
            return Promise.all(
                book.spine.spineItems.map(item => item.load(book.load.bind(book)).then(item.find.bind(item, q)).finally(item.unload.bind(item)))
            ).then(results => Promise.resolve([].concat.apply([], results)));
        }

        // Поиск по главе
        const doChapterSearch = (q) => {
            let item = book.spine.get(rendition.location.start.cfi);
            return item.load(book.load.bind(book)).then(item.find.bind(item, q)).finally(item.unload.bind(item));
        };


        let tocList = document.getElementById("toc-list");
        let currentChapter = document.getElementById("current-chapter");


        const getCfiFromHref = async (href) => {
            const id = href.split('#')[1]
            const item = book.spine.get(href)
            await item.load(book.load.bind(book))
            const el = id ? item.document.getElementById(id) : item.document.body
            return item.cfiFromElement(el)
        }

        const updateTocList = (location) => {
            let activeHref = location.start.href;
            let activeHrefWithHash = location.start.href + '#' + location.start.cfi.split('[')[1]?.split(']')[0];

            tocList.querySelectorAll("a").forEach(item => {

                let itemHref = item.getAttribute('href');
                let itemName = item.querySelector(".toc-name");
                let itemPage = item.querySelector(".toc-page");

                if (itemPage && itemPage.textContent.length === 0) {
                    getCfiFromHref(itemHref).then(r => {
                        let page = book.locations.locationFromCfi(r) + 1;
                        itemPage.textContent = page;
                    })
                }

                if ((itemHref === activeHref) || (itemHref === activeHrefWithHash) || (itemHref.startsWith(activeHref))) {
                    item.classList.add("active-chapter");
                    currentChapter.textContent = itemName.textContent;
                } else {
                    item.classList.remove("active-chapter");
                }
            });

            // скрываем все главы с подглавами без активной главы
            tocList.querySelectorAll("li").forEach(item => {
                const expanded = item.getAttribute('aria-expanded');
                if (expanded !== 'undefined') {
                    if (item.querySelectorAll(".active-chapter").length > 0) {
                        item.setAttribute('aria-expanded', 'true');
                    } else {
                        item.setAttribute('aria-expanded', 'false');
                    }
                }
            })

            updateLocationHistory(location);
            updateBookmarksAddDeleteButtonState();
        }

        // Загрузка оглавления
        book.loaded.navigation.then(function (toc) {
            const resolveURL = (url, relativeTo) => {
                const base = 'https://example.invalid/'
                return new URL(url, base + relativeTo).href.replace(base, '')
            }

            const basePath = book.packaging.navPath || book.packaging.ncxPath;

            let docfrag = document.createDocumentFragment();
            let addTocItems = function (parent, tocItems) {
                let ol = document.createElement("ol");

                tocItems.forEach(function (chapter) {
                    let item = document.createElement("li");
                    item.setAttribute('aria-expanded', 'false');
                    let itemContainer = document.createElement("div");
                    let expander = document.createElement("div");
                    expander.classList.add("expander");
                    let link = document.createElement("a");
                    let page = document.createElement("span");
                    page.classList.add("toc-page");
                    link.innerHTML = '<div class="toc-name">' + chapter.label + '</div>';
                    link.href = resolveURL(chapter.href, basePath);
                    expander.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--text)"><path d="m531.69-480-184-184L376-692.31 588.31-480 376-267.69 347.69-296l184-184Z"/></svg>';
                    expander.onclick = function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const expanded = item.getAttribute('aria-expanded');
                        item.setAttribute('aria-expanded', expanded === 'true' ? 'false' : 'true')
                    };

                    link.appendChild(page);

                    itemContainer.appendChild(expander);
                    itemContainer.appendChild(link);

                    item.appendChild(itemContainer);

                    if (chapter.subitems && chapter.subitems.length > 0) {
                        addTocItems(item, chapter.subitems);
                    } else {
                        item.setAttribute('aria-expanded', 'undefined');
                        expander.classList.add("hidden");
                    }

                    link.onclick = function () {
                        let url = link.getAttribute("href");
                        rendition.display(url);
                        toggleToc();
                        return false;
                    };

                    ol.appendChild(item);
                });
                parent.appendChild(ol);
            };

            addTocItems(docfrag, toc);
            tocList.appendChild(docfrag);
        });

        // Загрузка мета
        book.loaded.metadata.then(function (meta) {
            title.textContent = meta.title;
            author.textContent = meta.creator;

            document.querySelector('#al-author').textContent = meta.creator;
            document.querySelector('#al-title').textContent = meta.title;
            document.querySelector('#al-description').textContent = meta.description;

            if (meta.publisher) {
                document.querySelector('#al-publisher').innerHTML = "Publisher: " + meta.publisher;
            }
            if (meta.pubdate && meta.pubdate.length === 4) {
                document.querySelector('#al-date-published').textContent = meta.pubdate;
            }
        });

        book.loaded.cover.then(function (url) {
            if (!url) return;
            if (book.archived) {
                book.archive.createUrl(url).then((url) => {
                    cover.src = url;
                });
            }
            if (book.cover) {
                cover.src = book.cover;
            }
        });

        let readProgress = document.getElementById("read-progress");
        let currentPercent = document.querySelectorAll(".current-percent");

        let locationHistory = JSON.parse(localStorage.getItem("s-e-r_history-" + bookFileName)) || [];
        let historyListTable = document.querySelector("#history-list-table");
        let historyClear = document.querySelector("#history-list-clear-button");

        historyClear.addEventListener("click", (e) => {
            historyListTable.innerHTML = '<span class="font-size-small">Here your page history will be located.</span>';
            locationHistory = [];
            historyClear.disabled = true;
            localStorage.removeItem("s-e-r_history-" + bookFileName);
        })

        const generateHTML = (type = null, obj, query = null) => {

            if (type === 'search') {
                let table = document.createElement("table");
                let thead = document.createElement("thead");
                thead.innerHTML = `<tr>
                <th>Text</th>
                <th>Link</th>
            </tr>`;
                table.appendChild(thead);
                obj.forEach((o, i) => {
                    let tbody = document.createElement("tr");
                    let tdText = document.createElement("td");
                    let payload = document.createElement("div");
                    payload.classList.add('font-size-small');
                    payload.classList.add('opacity-50');
                    payload.classList.add('padding-bottom-6px');
                    let text = document.createElement("div");
                    tdText.classList.add('fill-rest');
                    let tdLink = document.createElement("td");
                    payload.innerHTML = 'Location ' + (parseInt(book.locations.locationFromCfi(o.cfi)) + 1);
                    text.innerHTML = highlightWord(o.excerpt, query);
                    tdLink.innerHTML = '<div class="menu-button"><svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="var(--text)"><path d="M701.38-464.62H200v-30.76h501.38L458.77-738 480-760l280 280-280 280-21.23-22 242.61-242.62Z"/></svg></div>'
                    tdLink.onclick = function () {
                        rendition.display(o.cfi);
                        toggleSearch();
                    };

                    tdText.appendChild(payload);
                    tdText.appendChild(text);
                    tbody.appendChild(tdText);
                    tbody.appendChild(tdLink);
                    table.appendChild(tbody);
                })
                return table;
            }

            if (type === 'history') {
                let table = document.createElement("table");
                let thead = document.createElement("thead");
                thead.innerHTML = `<tr>
                <th>Date</th>
                <th>Loc.</th>
                <th>Chapter</th>
                <th>Link</th>
            </tr>`;
                table.appendChild(thead);
                obj.forEach((o, i) => {
                    let tbody = document.createElement("tr");
                    let tdTime = document.createElement("td");
                    let tdPage = document.createElement("td");
                    let tdChapter = document.createElement("td");
                    tdChapter.classList.add('fill-rest');
                    let tdLink = document.createElement("td");
                    tdTime.innerHTML = o.time.split(' ')[1];
                    tdPage.innerHTML = o.page;
                    tdChapter.innerHTML = o.chapter;
                    if (i === 0) {
                        tdLink.innerHTML = '<span class="font-size-small">Current<br/>location</div>'
                    } else {
                        tdLink.innerHTML = '<div class="menu-button"><svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="var(--text)"><path d="M701.38-464.62H200v-30.76h501.38L458.77-738 480-760l280 280-280 280-21.23-22 242.61-242.62Z"/></svg></div>'
                        tdLink.onclick = function () {
                            rendition.display(o.start.cfi);
                            toggleBookmarks();
                        };
                    }

                    tbody.appendChild(tdTime);
                    tbody.appendChild(tdPage);
                    tbody.appendChild(tdChapter);
                    tbody.appendChild(tdLink);
                    table.appendChild(tbody);
                })
                return table;
            }

            if (type === 'bookmarks') {
                let table = document.createElement("table");
                let thead = document.createElement("thead");
                thead.innerHTML = `<tr>
                <th>Bookmark</th>
                <th>Delete</th>
                <th>Link</th>
            </tr>`;
                table.appendChild(thead);
                obj.forEach((o, i) => {
                    let tbody = document.createElement("tr");
                    let tdText = document.createElement("td");
                    tdText.classList.add('fill-rest');
                    let payload = document.createElement("div");
                    payload.classList.add('font-size-small');
                    payload.classList.add('opacity-50');
                    payload.classList.add('padding-bottom-6px');
                    let text = document.createElement("div");
                    let tdDelete = document.createElement("td");
                    let tdLink = document.createElement("td");
                    payload.innerHTML = 'Location ' + o.page + '' + (o.chapter ? ' • ' + o.chapter : '');
                    text.innerHTML = o.text;
                    tdDelete.innerHTML = '<div class="menu-button"><svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="var(--text)"><path d="M369.46-327.46 480-439.23l111.54 111.77 23.92-24.16-110.54-111.76 110.54-112.54-23.92-24.16L480-488.31 369.46-600.08l-24.92 24.16 111.54 112.54-111.54 111.76 24.92 24.16ZM295.62-160q-23.06 0-39.23-16.16-16.16-16.17-16.16-39.22v-518.47H200v-30.77h154.15v-26.15h251.7v26.15H760v30.77h-40.23v518.47q0 23.05-16.16 39.22Q687.44-160 664.38-160H295.62ZM689-733.85H271v518.47q0 9.23 7.69 16.92 7.69 7.69 16.93 7.69h368.76q9.24 0 16.93-7.69 7.69-7.69 7.69-16.92v-518.47Zm-418 0v543.08-543.08Z"/></svg></div>';
                    tdDelete.onclick = function () {
                        bookmarks.splice(i, 1);
                        updateBookmarks();
                    };
                    tdLink.innerHTML = '<div class="menu-button"><svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="var(--text)"><path d="M701.38-464.62H200v-30.76h501.38L458.77-738 480-760l280 280-280 280-21.23-22 242.61-242.62Z"/></svg></div>'
                    tdLink.onclick = function () {
                        rendition.display(o.start.cfi);
                        toggleBookmarks();
                    };

                    tdText.appendChild(payload);
                    tdText.appendChild(text);
                    tbody.appendChild(tdText);
                    tbody.appendChild(tdDelete);
                    tbody.appendChild(tdLink);
                    table.appendChild(tbody);
                })
                return table;
            }

            return;
        }
        const updateLocationHistory = (item) => {
            item.chapter = currentChapter.textContent;
            item.page = currentPage[0].textContent;
            item.time = (new Date()).toLocaleString();
            if (locationHistory && locationHistory[0]
                && JSON.stringify(locationHistory[0]) === JSON.stringify(item)) {
                return;
            }
            // Ограничение истории до 20 записей
            locationHistory.unshift(item) > 20 ? locationHistory.pop() : null;

            historyListTable.innerHTML = '';
            let h = generateHTML('history', locationHistory);
            historyListTable.appendChild(h);
            historyClear.disabled = false;

            localStorage.setItem("s-e-r_history-" + bookFileName, JSON.stringify(locationHistory));
            if (jumped) {
                jumpController();
            }
        }

        book.ready.then(function () {

            // In order to check the free space and clear it if necessary
            updateLocalStorage();

            let keyStoredCurrentLocation = "s-e-r_currentLocation-" + bookFileName;
            let storedCurrentLocation = localStorage.getItem(keyStoredCurrentLocation);
            if (storedCurrentLocation) {
                let loc = JSON.parse(storedCurrentLocation);
                rendition.display(loc.atEnd ? loc.end.cfi : loc.start.cfi);
            }

            // Load in stored locations from json or local storage
            let keyStoredLocations = "s-e-r_locations-" + bookFileName;
            let storedLocations = localStorage.getItem(keyStoredLocations);
            if (storedLocations) {
                return book.locations.load(storedLocations);
            } else {
                // Or generate the locations on the fly
                // Can pass an option number of chars to break sections by
                // default is 150 chars
                return book.locations.generate(1200);
            }
        })
            .then(function (locations) {
                loadingState = loadingStates.completed;
                loadCompleted();

                totalPages.forEach((el) => el.textContent = book.locations.total + 1);

                // Wait for book to be rendered to get current page
                displayed.then(function () {
                    // Get the current CFI
                    let currentLocation = rendition.currentLocation();
                    updateTocList(currentLocation);
                    let percentage = currentLocation.atEnd ? currentLocation.end.percentage * 100 : currentLocation.start.percentage * 100;

                    readProgress.value = percentage + ''
                    currentPercent.forEach(el => el.textContent = percentage + '')
                    let page = currentLocation.atEnd ? currentLocation.end.location + 1 : currentLocation.start.location + 1;
                    currentPage.forEach(el => el.textContent = page);
                });

                // Listen for location changed event, get percentage from CFI
                rendition.on('relocated', function (location) {

                    let page = location.atEnd ? location.end.location + 1 : location.start.location + 1;
                    currentPage.forEach(el => el.textContent = page);

                    let percentage = Math.floor(location.atEnd ? location.end.percentage * 100 : location.start.percentage * 100);

                    currentPercent.forEach(el => el.textContent = percentage + '');
                    readProgress.value = percentage;

                    localStorage.setItem("s-e-r_currentLocation-" + bookFileName, JSON.stringify(location));
                    updateTocList(location);
                });

                // Save out the generated locations to JSON
                localStorage.setItem("s-e-r_locations-" + bookFileName, book.locations.save());
                updateLocalStorage();
            });


        rendition.themes.register("dark", "./src/css/themes.css");
        rendition.themes.register("light", "./src/css/themes.css");
        rendition.themes.register("system", "./src/css/themes.css");

        const stylesheet = document.documentElement.style;
        const setNightMode = (mode) => {
            if (mode === "system") {
                if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    //stylesheet.setProperty("color-scheme", "dark");
                    //stylesheet.setProperty("--text", '#fff');
                    //stylesheet.setProperty("--bg", '#000');
                    //stylesheet.setProperty("--bgSecondary", '#333');
                } else {
                    //stylesheet.setProperty("color-scheme", "only");
                    //stylesheet.setProperty("--text", '#000');
                    //stylesheet.setProperty("--bg", '#fff');
                    //stylesheet.setProperty("--bgSecondary", '#fff');
                }
                rendition.themes.select("system");
            }
            if (mode === "light") {
                stylesheet.setProperty("--text", '#000');
                stylesheet.setProperty("--bg", '#fff');
                stylesheet.setProperty("--bgSecondary", '#fff');
                rendition.themes.select("light")
            }
            if (mode === "dark") {
                stylesheet.setProperty("--text", '#fff');
                stylesheet.setProperty("--bg", '#000');
                stylesheet.setProperty("--bgSecondary", '#333');
                rendition.themes.select("dark")
            }
        }

        const defaultSettings = {
            "body": {
                "padding-top": '0',
                "padding-bottom": '0',
                "line-height": '160%',
                "font-size": '120%',
                "theme": "system"
            },
            p: {
                "font-family": 'Segoe UI,system-ui,-apple-system,sans-serif',
                "text-align": 'justify',
                "font-weight": '400',
                "hyphens": "manual"
            }
        }

        let themeSettings = {
            body: {
                "padding-top": '0',
                "padding-bottom": '0',
                "line-height": '160%',
                "font-size": '120%',
                "theme": "system"
            },
            p: {
                "font-family": 'Segoe UI,system-ui,-apple-system,sans-serif',
                "text-align": 'justify',
                "font-weight": '400',
                "hyphens": "manual"
            }
        }

        const updateAppearanceSettings = (themeSettings) => {
            document.querySelector('#font-size_range').value = themeSettings.body["font-size"].split('%')[0] / 10;

            if (themeSettings.body['line-height'] === '120%') document.querySelector("input[id=line-spacing_small]").checked = true;
            if (themeSettings.body['line-height'] === '160%') document.querySelector("input[id=line-spacing_normal]").checked = true;
            if (themeSettings.body['line-height'] === '200%') document.querySelector("input[id=line-spacing_large]").checked = true;

            if (themeSettings.p['font-family'] === 'Segoe UI,system-ui,-apple-system,sans-serif%') document.querySelector("select[id=font-family_select]").value = 'system';
            if (themeSettings.p['font-family'] === 'serif') document.querySelector("select[id=font-family_select]").value = 'serif';
            if (themeSettings.p['font-family'] === 'sans-serif') document.querySelector("select[id=font-family_select]").value = 'sans-serif';
            if (themeSettings.p['font-family'] === 'monospace') document.querySelector("select[id=font-family_select]").value = 'monospace';

            if (themeSettings.p['font-weight'] === '400') document.querySelector("input[id=font-weight_bold]").checked = false;
            if (themeSettings.p['font-weight'] === '700') document.querySelector("input[id=font-weight_bold]").checked = true;

            if (themeSettings.p['text-align'] === 'justify') document.querySelector("input[id=text-align_justify]").checked = true;
            if (themeSettings.p['text-align'] === 'left') document.querySelector("input[id=text-align_left]").checked = true;

            if (themeSettings.p['hyphens'] === 'manual') document.querySelector("input[id=hyphens_rule]").checked = false;
            if (themeSettings.p['hyphens'] === 'auto') document.querySelector("input[id=hyphens_rule]").checked = true;

            if (themeSettings.body['theme'] === 'system') document.querySelector("input[id=night-mode_system]").checked = true;
            if (themeSettings.body['theme'] === 'light') document.querySelector("input[id=night-mode_light]").checked = true;
            if (themeSettings.body['theme'] === 'dark') document.querySelector("input[id=night-mode_dark]").checked = true;
        }

        const applyTheme = (id = null, checked = null, value = null, reset = false) => {
            if (!id && !checked && !value && !reset) {
                let storedSettings = localStorage.getItem("s-e-r_theme");
                if (storedSettings) {
                    themeSettings = JSON.parse(storedSettings);
                    rendition.themes.default(JSON.parse(storedSettings));
                    rendition.themes.fontSize(JSON.parse(storedSettings).body["font-size"]);
                    setNightMode(JSON.parse(storedSettings).body["theme"]);
                    updateAppearanceSettings(JSON.parse(storedSettings));
                } else {
                    applyTheme(null, null, null, true);
                }
            }
            if (reset) {
                localStorage.removeItem("s-e-r_theme");
                themeSettings = JSON.parse(JSON.stringify(defaultSettings));
                rendition.themes.default(defaultSettings);
                rendition.themes.fontSize(defaultSettings.body["font-size"]);
                updateAppearanceSettings(defaultSettings);
                setNightMode("system");
            }
            let p = id?.split('_');
            if (p) {
                if (p[0] === 'line-spacing') {
                    if (p[1] === 'small') themeSettings.body["line-height"] = "120%";
                    if (p[1] === 'normal') themeSettings.body["line-height"] = "160%";
                    if (p[1] === 'large') themeSettings.body["line-height"] = "200%";
                }
                if (p[0] === 'text-align') {
                    if (p[1] === 'left') themeSettings.p["text-align"] = "left";
                    if (p[1] === 'justify') themeSettings.p["text-align"] = "justify";
                }
                if (p[0] === 'font-weight') {
                    if (checked === true) {
                        themeSettings.p["font-weight"] = "700";
                    } else {
                        themeSettings.p["font-weight"] = "400"
                    }
                }
                if (p[0] === 'hyphens') {
                    if (checked === true) {
                        themeSettings.p["hyphens"] = "auto";
                    } else {
                        themeSettings.p["hyphens"] = "manual"
                    }
                }
                if (p[0] === 'font-size') {
                    themeSettings.body["font-size"] = value * 10 + "%";
                    rendition.themes.fontSize(value * 10 + "%");
                }
                if (p[0] === 'font-family') {
                    if (value === 'system') {
                        themeSettings.p["font-family"] = 'Segoe UI,system-ui,-apple-system,sans-serif';
                    }
                    if (value === 'serif') {
                        themeSettings.p["font-family"] = 'serif';
                    } else if (value === 'sans-serif') {
                        themeSettings.p["font-family"] = 'sans-serif';
                    } else if (value === 'monospace') {
                        themeSettings.p["font-family"] = 'monospace';
                    } else {
                        themeSettings.p["font-family"] = 'Segoe UI,system-ui,-apple-system,sans-serif';
                    }
                }
                if (p[0] === 'night-mode') {
                    if (p[1] === 'light') {
                        themeSettings.body["theme"] = 'light';
                        setNightMode("light");
                    } else if (p[1] === 'dark') {
                        themeSettings.body["theme"] = 'dark';
                        setNightMode("dark");
                    } else {
                        themeSettings.body["theme"] = 'system';
                        setNightMode("system");
                    }
                }
                rendition.themes.default(themeSettings);
                localStorage.setItem("s-e-r_theme", JSON.stringify(themeSettings));
            }
        }

        applyTheme();
    }


    let book = null;
    let bookFile = null;
    let bookFileName = null;

    let params = new URLSearchParams(document.location.search);
    if (params.get("book") && params.get("book").length > 0) {
        bookFile = document.location.href.split('?')[0] + params.get("book");
        bookFileName = params.get("book")?.split('/')?.slice(-1)[0];

        fetch(bookFile, {method: 'HEAD'})
            .then(res => {
                if (res.ok) {
                    if (book) book.destroy();
                    book = ePub(bookFile);
                    openBook();
                } else {
                    //params.delete("book");
                    //window.location.href = document.location.href.split('?')[0];
                    //window.location.href='?book=';
                    loadFailed();
                }
            }).catch(err => {
            console.log(err)
        });
    }

    let fileInput = document.getElementById('file-input');

    fileInput.addEventListener('change', (event) => {

        const file = event.target.files[0];

        async function openEpub(arrayBuffer) {
            if (book) book.destroy();
            book = await ePub(arrayBuffer);
            openBook();
        }

        if (file) {

            loadStart();
            const reader = new FileReader();
            reader.addEventListener('load', (event) => {
                const result = event.target.result;
                //console.log(reader.result)
                //console.log(result)
                //console.log(file)
                bookFileName = file.name;
                openEpub(result);
            });

            reader.addEventListener('progress', (event) => {
                if (event.loaded && event.total) {
                    const percent = (event.loaded / event.total) * 100;
                    //console.log(`Progress: ${Math.round(percent)}`);
                }
            });
            reader.readAsArrayBuffer(file);
        } else {
            loadFailed();
            loadingState = loadingStates.error;
        }

    });


}

document.addEventListener("DOMContentLoaded", ready);