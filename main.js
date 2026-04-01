/* ================= SYSTEM UTILS ================= */
const UI = {
    toast: (msg, type = 'info') => {
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = 'toast';
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warn: '⚠️'
        };
        el.innerHTML = `<span style="font-size:1.2rem">${icons[type]||icons.info}</span><span>${msg}</span>`;
        container.appendChild(el);
        setTimeout(() => el.classList.add('show'), 10);
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 400);
        }, 3000);
    },
    log: (msg, type = 'info') => {
        const box = document.getElementById('logBox');
        if (box.querySelector('span[style]')) box.innerHTML = '';
        const time = new Date().toLocaleTimeString('vi-VN', {
            hour12: false
        });
        const line = document.createElement('div');
        line.className = `log-line text-${type}`;
        line.innerText = `[${time}] ${msg}`;
        box.appendChild(line);
        box.scrollTop = box.scrollHeight;
    },
    processing: (state, total = 0) => {
        const btn = document.getElementById('startBtn');
        const spinner = document.getElementById('btnSpinner');
        const text = document.getElementById('btnText');
        const barWrap = document.getElementById('progressContainer');
        const bar = document.getElementById('progressBar');
        if (state) {
            btn.disabled = true;
            spinner.style.display = 'block';
            text.innerText = `Đang xử lý (0/${total})...`;
            barWrap.style.display = 'block';
            bar.style.width = '0%';
        } else {
            btn.disabled = false;
            spinner.style.display = 'none';
            text.innerText = 'Bắt đầu Fetch Dữ Liệu';
            setTimeout(() => {
                barWrap.style.display = 'none';
            }, 2000);
        }
    }
};

function onEditorInput() {
    searchState.isDirty = true;
    updateStats();
}

function updateStats() {
    const text = document.getElementById('editor').value;
    const charCount = text.length;
    
    // Đếm số từ, số dòng
    const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const lineCount = text === '' ? 0 : text.split(/\n/).length;

    // Tính thời gian TTS (Tốc độ 1.35x = ~255 từ / phút)
    const WPM = 255; 
    const totalRawMinutes = wordCount / WPM;
    const hours = Math.floor(totalRawMinutes / 60);
    const minutes = Math.floor(totalRawMinutes % 60);
    const seconds = Math.round((totalRawMinutes - Math.floor(totalRawMinutes)) * 60);

    let timeStr = "";
    if (hours > 0) {
        timeStr = `${hours}h ${minutes}p ${seconds}s`;
    } else {
        timeStr = `${minutes}p ${seconds}s`;
    }

    document.getElementById('charCount').innerHTML = 
        `<span style="color:var(--text-muted)">${lineCount.toLocaleString()} dòng | ${wordCount.toLocaleString()} từ | ${charCount.toLocaleString()} ký tự | <span style="color:var(--primary)">🎧 ~${timeStr}</span></span>`;
}

function toggleConfig() {
    const type = document.querySelector('input[name="sourceType"]:checked').value;
    document.getElementById('customConfigBox').style.display = (type === 'custom') ? 'flex' : 'none';
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`button[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

/* ================= DRAG & DROP IMPORT ================= */
const editorWrapper = document.getElementById('editorWrapper');
const editorEle = document.getElementById('editor');

editorWrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
    editorWrapper.classList.add('drag-over');
});

editorWrapper.addEventListener('dragleave', (e) => {
    e.preventDefault();
    editorWrapper.classList.remove('drag-over');
});

editorWrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    editorWrapper.classList.remove('drag-over');
    
    if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        
        // Validate MIME type hoac duoi .txt
        if (file.type !== 'text/plain' && !file.name.toLowerCase().endsWith('.txt')) {
            return UI.toast("Chỉ hỗ trợ file định dạng Text (.txt)", "error");
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            editorEle.value = event.target.result;
            updateStats();
            searchState.isDirty = true;
            UI.toast(`Đã nhập dữ liệu từ file: ${file.name}`, "success");
            UI.log(`Nhập file thành công: ${file.name} (${file.size} bytes)`, "success");
        };
        reader.onerror = () => UI.toast("Lỗi đọc file!", "error");
        reader.readAsText(file);
    }
});


/* ================= KEYBOARD SHORTCUTS ================= */
document.addEventListener('keydown', (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;

    // Ctrl + S: Tải xuống file
    if (isCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        downloadText();
    }

    // Ctrl + F: Chuyển sang tìm kiếm
    if (isCtrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        switchTab('search');
        document.getElementById('findStr').focus();
    }

    // Ctrl + Enter: Hành động tùy Tab
    if (isCtrl && e.key === 'Enter') {
        e.preventDefault();
        if (document.getElementById('tab-fetch').classList.contains('active')) {
            startFetch();
        } else if (document.getElementById('tab-search').classList.contains('active')) {
            replaceAll();
        }
    }
});

// Sự kiện riêng cho ô Find: Enter / Shift+Enter
document.getElementById('findStr').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); // Tránh tạo dòng mới trong textarea
        
        if (searchState.isDirty || searchState.matches.length === 0) {
            initSearch();
        } else {
            navMatch(e.shiftKey ? -1 : 1);
        }
    }
});


/* ================= PERSONAL PRESET (BỘ LỌC CÁ NHÂN) ================= */
let appPresets = JSON.parse(localStorage.getItem('aio_presets')) || [];

function openPresetModal() {
    document.getElementById('presetModal').classList.add('show');
    renderPresets();
}

function closePresetModal() {
    document.getElementById('presetModal').classList.remove('show');
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

function renderPresets() {
    const list = document.getElementById('presetList');
    if (appPresets.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding: 30px 0;">Bạn chưa có quy tắc nào trong bộ lọc.</div>';
        return;
    }
    list.innerHTML = appPresets.map((p, i) => `
        <div class="preset-item">
            <div class="preset-item-info">
                ${p.isRegex ? '<span class="tag-regex">REGEX</span>' : ''}
                <span style="color:var(--danger)">${escapeHTML(p.find)}</span>
                <span style="color:var(--text-muted); margin: 0 8px;">➔</span>
                <span style="color:var(--success)">${escapeHTML(p.replace)}</span>
            </div>
            <button class="btn-del" onclick="deletePreset(${i})">Xóa</button>
        </div>
    `).join('');
}

function addPreset() {
    const findInput = document.getElementById('presetFind');
    const replaceInput = document.getElementById('presetReplace');
    const regexInput = document.getElementById('presetRegex');

    const findVal = findInput.value;
    if (!findVal) return UI.toast("Vui lòng nhập từ khóa cần tìm", "warn");

    if (regexInput.checked) {
        try { new RegExp(findVal); } 
        catch (e) { return UI.toast("Biểu thức Regex không hợp lệ!", "error"); }
    }

    appPresets.push({
        find: findVal,
        replace: replaceInput.value,
        isRegex: regexInput.checked
    });

    localStorage.setItem('aio_presets', JSON.stringify(appPresets));
    findInput.value = '';
    replaceInput.value = '';
    renderPresets();
    UI.toast("Đã thêm quy tắc lọc", "success");
}

function deletePreset(index) {
    appPresets.splice(index, 1);
    localStorage.setItem('aio_presets', JSON.stringify(appPresets));
    renderPresets();
}

function runAllPresets() {
    if (appPresets.length === 0) return UI.toast("Không có quy tắc nào để chạy!", "warn");

    const editor = document.getElementById('editor');
    let text = editor.value;
    if (!text) return UI.toast("Không có nội dung để lọc!", "warn");

    let totalReplaced = 0;

    appPresets.forEach(rule => {
        let regex;
        if (rule.isRegex) {
            regex = new RegExp(rule.find, 'gs'); 
        } else {
            regex = new RegExp(rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        }

        const matches = text.match(regex);
        if (matches) {
            totalReplaced += matches.length;
            text = text.replace(regex, rule.replace);
        }
    });

    if (totalReplaced > 0) {
        editor.value = text;
        updateStats();
        searchState.isDirty = true;
        UI.toast(`Đã thay thế thành công ${totalReplaced} vị trí!`, "success");
        UI.log(`[Bộ lọc cá nhân] Hoàn tất thay thế ${totalReplaced} cụm từ.`, "success");
    } else {
        UI.toast("Không tìm thấy cụm từ nào khớp với bộ lọc.", "info");
    }
    closePresetModal();
}

/* ================= WATTPAD.COM SPECIFIC FUNCTIONS ================= */
function extractWattpadCOMContent(html, isFirstPage) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let title = "";
    let content = "";

    if (isFirstPage) {
        const titleTag = doc.querySelector('h1.h2');
        if (titleTag) {
            title = titleTag.textContent.trim().toUpperCase();
        }
    }

    const paragraphs = doc.querySelectorAll('p[data-p-id]');
    paragraphs.forEach(p => {
        p.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        let txt = p.textContent.trim();
        if (txt) content += txt + "\n\n";
    });

    return { title, content };
}

async function fetchWattpadCOM(url) {
    const encodedUrl = encodeURIComponent(url);
    const proxies = [
        `https://api.allorigins.win/raw?url=${encodedUrl}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}`,
        `https://corsproxy.io/?${encodedUrl}`,
        `https://thingproxy.freeboard.io/fetch/${url}`
    ];

    for (let i = 0; i < proxies.length; i++) {
        try {
            const response = await fetch(proxies[i]);
            if (response.ok) {
                const html = await response.text();
                if (html && html.length > 1000) {
                    return html;
                }
            }
        } catch (e) {
            if (i === proxies.length - 1) {
                UI.log(`  ⚠️ Tất cả proxy thất bại`, 'warn');
            }
        }
    }
    return null;
}

async function processWattpadCOMContent(links) {
    const editor = document.getElementById("editor");
    let output = "";
    let successCount = 0;
    let failedLinks = [];
    let linksWithMissingPages = [];

    for (let i = 0; i < links.length; i++) {
        const baseUrl = links[i].trim();
        const linkIndex = i + 1;
        UI.log(`📖 [${linkIndex}/${links.length}] Xử lý: ${baseUrl}`, "info");

        let fullText = "";
        let page = 1;
        let hasNext = true;
        let lastPageContent = "";
        let pageCount = 0;
        let missingPages = [];
        let chapterTitle = "";
        let allPages = [];
        let lastSuccessfulPage = 0;

        while (hasNext) {
            const currentUrl = page === 1 ? baseUrl : `${baseUrl}/page/${page}`;
            UI.log(`  📄 Đang tải trang ${page}...`, "info");

            const html = await fetchWattpadCOM(currentUrl);

            if (html) {
                const { title, content } = extractWattpadCOMContent(html, page === 1);
                
                if (page === 1 && title) {
                    chapterTitle = title;
                }
                
                if (content.length > 50 && content !== lastPageContent) {
                    allPages[page] = content;
                    lastPageContent = content;
                    pageCount++;
                    lastSuccessfulPage = page;
                    
                    if (html.includes(`/page/${page + 1}`)) {
                        page++;
                        await new Promise(r => setTimeout(r, 300));
                    } else {
                        hasNext = false;
                        UI.log(`  🔚 Không còn trang tiếp theo, kết thúc.`, "info");
                    }
                } else {
                    if (content.length <= 50) {
                        UI.log(`  ⚠️ Trang ${page}: Nội dung quá ngắn (${content.length} ký tự), kết thúc.`, "warn");
                    }
                    hasNext = false;
                }
            } else {
                missingPages.push(page);
                allPages[page] = null;
                UI.log(`  ❌ Trang ${page}: Tải thất bại, đánh dấu là trang thiếu`, "error");
                
                if (lastSuccessfulPage > 0 && page - lastSuccessfulPage <= 2) {
                    page++;
                    await new Promise(r => setTimeout(r, 300));
                } else {
                    hasNext = false;
                }
            }
        }

        if (pageCount > 0) {
            successCount++;
            
            let linkContent = `=== LINK ${linkIndex} ===\n`;
            linkContent += `(${pageCount}/${pageCount + missingPages.length} trang - ${missingPages.length} trang thiếu)\n\n`;
            
            if (chapterTitle) {
                linkContent += `[${chapterTitle}]\n\n`;
            }
            
            let maxPage = Math.max(...Object.keys(allPages).map(Number).filter(p => !isNaN(p)));
            for (let p = 1; p <= maxPage; p++) {
                if (allPages[p] !== undefined) {
                    if (allPages[p] === null) {
                        linkContent += `ĐANG THIẾU TRANG ${p}\n\n`;
                    } else {
                        linkContent += `${allPages[p]}\n`;
                    }
                }
            }
            
            linkContent += `========================\n\n`;
            output += linkContent;
            
            let logMsg = `✅ Link ${linkIndex} HOÀN THÀNH: ${pageCount} trang thành công`;
            if (missingPages.length > 0) {
                logMsg += `, ${missingPages.length} trang thiếu (${missingPages.join(', ')})`;
                linksWithMissingPages.push({ url: baseUrl, missing: missingPages });
            }
            UI.log(logMsg, missingPages.length > 0 ? "warn" : "success");
        } else {
            failedLinks.push(baseUrl);
            output += `\n=== LỖI: ${baseUrl} ===\n\n`;
            UI.log(`❌ Link ${linkIndex} THẤT BẠI: Không có nội dung nào được tải`, "error");
        }
        
        document.getElementById('progressBar').style.width = `${Math.round(((i+1)/links.length)*100)}%`;
        document.getElementById('btnText').innerText = `Đang xử lý (${i+1}/${links.length})...`;
        
        if (i < links.length - 1) {
            await new Promise(r => setTimeout(r, 500));
        }
    }
    
    editor.value = output;
    return { 
        successCount, 
        totalLinks: links.length, 
        failedLinks, 
        linksWithMissingPages 
    };
}

/* ================= ADVANCED FIND & REPLACE ENGINE ================= */
let searchState = {
    matches: [],
    currentIndex: -1,
    isDirty: false
};

function getSearchRegex() {
    const findStr = document.getElementById('findStr').value;
    if (!findStr) return null;
    const useRegex = document.getElementById('useRegex').checked;
    const caseSensitive = document.getElementById('caseSensitive').checked;

    let flags = 'gs';
    if (!caseSensitive) flags += 'i';

    try {
        if (useRegex) {
            return new RegExp(findStr, flags);
        } else {
            return new RegExp(findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        }
    } catch {
        return null;
    }
}

function performScan() {
    const editor = document.getElementById('editor');
    const regex = getSearchRegex();
    if (!editor.value || !regex) return [];

    let matches = [];
    let match;
    regex.lastIndex = 0;

    while ((match = regex.exec(editor.value)) !== null) {
        matches.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }
    return matches;
}

function initSearch() {
    const editor = document.getElementById('editor');
    const regex = getSearchRegex();

    if (!editor.value) return UI.toast("Editor trống!", "warn");
    if (!regex) return UI.toast("Nhập từ khóa tìm kiếm!", "warn");

    searchState.matches = performScan();
    searchState.isDirty = false;

    const count = searchState.matches.length;
    document.getElementById('navControls').classList.add('active');

    if (count > 0) {
        const currentPos = editor.selectionStart;
        let bestIndex = 0;
        for (let i = 0; i < count; i++) {
            if (searchState.matches[i].start >= currentPos) {
                bestIndex = i;
                break;
            }
        }
        searchState.currentIndex = bestIndex;
        updateNavUI();
        highlightMatch();
        UI.log(`Tìm thấy ${count} kết quả.`, 'success');
    } else {
        searchState.currentIndex = -1;
        document.getElementById('navCounter').innerText = "0 / 0";
        UI.toast("Không tìm thấy kết quả nào", "warn");
    }
}

function updateNavUI() {
    const current = searchState.currentIndex + 1;
    const total = searchState.matches.length;
    document.getElementById('navCounter').innerText = `${current} / ${total}`;
}

function scrollToMatch(start, end) {
    const editor = document.getElementById('editor');
    const text = editor.value;

    const mirror = document.createElement('div');
    const style = window.getComputedStyle(editor);

    const props = [
        'font-family', 'font-size', 'font-weight', 'line-height',
        'padding', 'border', 'width', 'white-space', 'word-wrap', 'word-break',
        'box-sizing'
    ];
    props.forEach(p => mirror.style[p] = style[p]);

    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.top = '0';
    mirror.style.left = '0';
    mirror.style.overflow = 'hidden';

    const beforeText = text.substring(0, start);
    const matchText = text.substring(start, end);

    mirror.textContent = beforeText;
    const span = document.createElement('span');
    span.textContent = matchText;
    mirror.appendChild(span);

    document.body.appendChild(mirror);

    const offsetTop = span.offsetTop;
    const editorHeight = editor.clientHeight;

    const scrollTarget = offsetTop - (editorHeight / 2) + parseInt(style.paddingTop);

    editor.scrollTo({
        top: scrollTarget > 0 ? scrollTarget : 0,
        behavior: 'smooth'
    });

    document.body.removeChild(mirror);
}

function highlightMatch() {
    if (searchState.matches.length === 0) return;
    if (searchState.currentIndex < 0 || searchState.currentIndex >= searchState.matches.length) return;

    const editor = document.getElementById('editor');
    const match = searchState.matches[searchState.currentIndex];

    editor.focus();
    editor.setSelectionRange(match.start, match.end);

    scrollToMatch(match.start, match.end);
}

function navMatch(dir) {
    if (searchState.isDirty) {
        const currentPos = document.getElementById('editor').selectionStart;
        searchState.matches = performScan();
        searchState.isDirty = false;

        if (searchState.matches.length === 0) {
            document.getElementById('navCounter').innerText = "0 / 0";
            return;
        }

        if (dir === 1) {
            searchState.currentIndex = searchState.matches.findIndex(m => m.start >= currentPos);
            if (searchState.currentIndex === -1) searchState.currentIndex = 0;
        } else {
            for (let i = searchState.matches.length - 1; i >= 0; i--) {
                if (searchState.matches[i].start < currentPos) {
                    searchState.currentIndex = i;
                    break;
                }
            }
            if (searchState.currentIndex === -1) searchState.currentIndex = searchState.matches.length - 1;
        }
    } else {
        if (searchState.matches.length === 0) return;
        searchState.currentIndex += dir;
        if (searchState.currentIndex >= searchState.matches.length) searchState.currentIndex = 0;
        if (searchState.currentIndex < 0) searchState.currentIndex = searchState.matches.length - 1;
    }

    updateNavUI();
    highlightMatch();
}

function replaceOne() {
    if (searchState.isDirty || searchState.matches.length === 0) {
        initSearch();
        if (searchState.matches.length === 0) return UI.toast("Không tìm thấy gì để thay", "warn");
    }

    if (searchState.currentIndex === -1) return UI.toast("Hãy chọn một kết quả", "warn");

    const editor = document.getElementById('editor');
    const replaceStr = document.getElementById('replaceStr').value;
    const match = searchState.matches[searchState.currentIndex];

    editor.setRangeText(replaceStr, match.start, match.end, 'select');
    UI.toast("Đã thay thế", "success");

    searchState.isDirty = true;
    updateStats();
}

function replaceAll() {
    const regex = getSearchRegex();
    if (!regex) return;
    const editor = document.getElementById('editor');
    const count = (editor.value.match(regex) || []).length;
    if (count === 0) return UI.toast("Không có gì để thay", "warn");

    if (confirm(`Thay thế toàn bộ ${count} vị trí?`)) {
        const replaceStr = document.getElementById('replaceStr').value;
        editor.value = editor.value.replace(regex, replaceStr);

        UI.toast(`Đã thay thế ${count} mục`, "success");

        searchState.matches = [];
        document.getElementById('navCounter').innerText = "0 / 0";
        searchState.isDirty = true;
        updateStats();
    }
}

/* ================= CORE FETCH LOGIC ================= */
async function stableFetch(url) {
    const fetchWithTimeout = async (target, timeout = 6000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(target, {
                signal: controller.signal
            });
            clearTimeout(id);
            return res.ok ? await res.text() : null;
        } catch {
            return null;
        }
    };

    const encoded = encodeURIComponent(url);
    const proxies = [
        `https://api.allorigins.win/raw?url=${encoded}`,
        `https://api.codetabs.com/v1/proxy?quest=${encoded}`,
        `https://corsproxy.io/?${encoded}`,
        `https://thingproxy.freeboard.io/fetch/${url}`
    ];

    for (let i = 0; i < proxies.length; i++) {
        UI.log(`Layer ${i+1} connecting...`, 'info');
        const html = await fetchWithTimeout(proxies[i]);
        if (html && html.length > 50) {
            if (i > 0) UI.log(`✅ Layer ${i+1} backup success!`, 'success');
            return html;
        } else {
            UI.log(`⚠️ Layer ${i+1} failed/blocked.`, 'warn');
        }
    }
    return null;
}

function getSmartText(node) {
    if (!node) return '';
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType === 1) {
        if (node.hasAttribute('style')) {
            const style = node.getAttribute('style').toLowerCase().replace(/\s+/g, '');
            const isHiddenOffscreen = style.includes('position:absolute') && 
                (style.includes('left:-9999') || style.includes('top:-9999'));
            const isHiddenZIndex = style.includes('position:absolute') && style.includes('z-index:-1000');

            if (isHiddenOffscreen || isHiddenZIndex) {
                return ''; 
            }
        }
        
        try {
            const computedStyle = window.getComputedStyle(node);
            if (computedStyle && computedStyle.display === 'none') return '';
        } catch(e) {}
        
        if (['SCRIPT', 'STYLE'].includes(node.tagName)) return '';
        if (node.tagName === 'BR') return '\n\n';
        
        let content = '';
        node.childNodes.forEach(c => {
            let t = getSmartText(c);
            if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI'].includes(c.tagName)) t = '\n\n' + t + '\n\n';
            content += t;
        });
        return content;
    }
    return '';
}

async function startFetch() {
    const links = document.getElementById("links").value.trim().split("\n").filter(x => x.trim());
    if (!links.length) return UI.toast("Vui lòng nhập link!", "error");

    const hiddenRule = document.getElementById("hiddenCode").value.trim();
    const type = document.querySelector('input[name="sourceType"]:checked').value;
    const selector = document.getElementById("customSelectors").value.trim();
    const editor = document.getElementById("editor");

    if (type === 'wattpadcom') {
        UI.processing(true, links.length);
        document.getElementById('logBox').innerHTML = '';
        editor.value = "";
        UI.log("🚀 KHỞI ĐỘNG HỆ THỐNG WATTPAD.COM...", "info");
        UI.log("📊 Sử dụng 4 lớp proxy dự phòng", "info");
        
        const result = await processWattpadCOMContent(links);
        
        UI.processing(false);
        updateStats();
        
        let summary = `🎯 TỔNG KẾT WATTPAD.COM:\n`;
        summary += `• Tổng link: ${result.totalLinks}\n`;
        summary += `• Thành công: ${result.successCount}\n`;
        summary += `• Thất bại: ${result.failedLinks.length}\n`;
        
        if (result.failedLinks.length > 0) {
            summary += `\n📋 DANH SÁCH LINK THẤT BẠI:\n`;
            result.failedLinks.forEach(link => {
                summary += `  ❌ ${link}\n`;
            });
        }
        
        if (result.linksWithMissingPages.length > 0) {
            summary += `\n⚠️ CÁC LINK CÓ TRANG THIẾU:\n`;
            result.linksWithMissingPages.forEach(item => {
                summary += `  • ${item.url} (thiếu trang: ${item.missing.join(', ')})\n`;
            });
        }
        
        UI.log(summary, result.failedLinks.length > 0 ? "warn" : "success");
        UI.toast(`Hoàn tất! ${result.successCount}/${result.totalLinks} link thành công`, 
                result.successCount === result.totalLinks ? "success" : "info");
        return;
    }

    UI.processing(true, links.length);
    document.getElementById('logBox').innerHTML = '';
    editor.value = "";

    let output = "";
    let successCount = 0;
    let failedLinks = [];

    for (let i = 0; i < links.length; i++) {
        const url = links[i].trim();
        UI.log(`Fetching: ${url}`, 'info');
        document.getElementById('progressBar').style.width = `${Math.round(((i+1)/links.length)*100)}%`;
        document.getElementById('btnText').innerText = `Đang xử lý (${i+1}/${links.length})...`;

        const html = await stableFetch(url);
        if (!html) {
            UI.log(`❌ Thất bại toàn bộ 4 Layers: ${url}`, 'error');
            failedLinks.push(url);
            output += `\n=== LỖI KẾT NỐI: ${url} ===\n\n`;
            continue;
        }

        UI.log(`✅ Tải xong. Parsing HTML...`, 'success');
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        if (hiddenRule) {
            try {
                doc.querySelectorAll("*").forEach(el => {
                    if (el.outerHTML.includes(hiddenRule) || el.className?.includes(hiddenRule)) el.remove();
                });
            } catch {}
        }

        let text = "";
        if (type === 'custom' && selector) {
            const nodes = doc.querySelectorAll(selector);
            nodes.forEach(n => text += getSmartText(n) + "\n\n");
        } else if (type === 'truyenfull') {
            text = (doc.querySelector('.chapter-title')?.textContent || '') + "\n\n" +
                getSmartText(doc.querySelector('#chapter-c'));
        } else if (type === 'wattpadvn') {
            text = (doc.querySelector('.current-chapter')?.textContent || '') + "\n\n" +
                getSmartText(doc.querySelector('.truyen'));
        } else {
            text = getSmartText(doc.body);
        }

        text = text.replace(/\u00A0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        output += `=== LINK ${i+1} ===\n${text}\n\n========================\n\n`;
        successCount++;
    }

    editor.value = output;
    updateStats();
    UI.processing(false);

    let summaryMsg = `\n=== 📊 TỔNG KẾT QUÁ TRÌNH ===\n`;
    summaryMsg += `• Tổng số link: ${links.length}\n`;
    summaryMsg += `• Thành công: ${successCount}\n`;
    summaryMsg += `• Thất bại: ${failedLinks.length}`;

    if (failedLinks.length > 0) {
        summaryMsg += `\n\n[DANH SÁCH THẤT BẠI]:\n`;
        failedLinks.forEach(l => summaryMsg += `- ${l}\n`);
        UI.log(summaryMsg, 'error');
    } else {
        summaryMsg += `\n\n🎉 Tất cả hoàn hảo!`;
        UI.log(summaryMsg, 'success');
    }
    UI.toast(`Hoàn tất! ${successCount}/${links.length} thành công`, 'success');
}

function formatWattpad() {
    const editor = document.getElementById("editor");
    const oldContent = editor.value;
    if (!oldContent) return UI.toast("Chưa có nội dung để lọc!", "warn");

    const lines = oldContent.split('\n').filter(line => {
        const t = line.trim();
        if (t.startsWith('=== LINK')) return false;
        if (/^\++$/.test(t) || /^\*+$/.test(t) || /^\=+$/.test(t)) return false;
        if (/^(?:[1-9]|[1-9]\d|[1-9]\d{2}|1000)$/.test(t)) return false;
        return true;
    });

    const newContent = lines.join('\n');
    const removedLines = oldContent.split('\n').length - lines.length;
    editor.value = newContent;
    UI.toast(`Đã xóa ${removedLines} dòng rác (bao gồm '=== LINK' và dòng đánh số)`, "success");
    updateStats();
}

function smartJoin() {
    const editor = document.getElementById("editor");
    if (!editor.value) return UI.toast("Không có nội dung!", "warn");
    let blocks = editor.value.replace(/\r\n/g, '\n').split(/\n{2,}/);
    let joined = blocks.map(b => b.split('\n').map(l => l.trim()).filter(l => l.length > 0).join(' '));
    editor.value = joined.join('\n\n');
    UI.toast("Đã nối thông minh", "success"); updateStats();
}

function formatVanAn() {
    const editor = document.getElementById("editor");
    if (!editor.value.trim()) return UI.toast("Không có nội dung!", "warn");
    const lines = editor.value.split(/\r?\n/);
    editor.value = lines.map(line => line.trim()).filter(line => line.length > 0).join('\\n');
    UI.toast("Đã Format Văn Án", "success");
    updateStats();
}

function removeEmptyLines() {
    const ed = document.getElementById("editor");
    if (!ed.value) return;
    let content = ed.value;
    content = content.replace(/[ \t]+$/gm, '');
    content = content.replace(/\n{3,}/g, '\n\n');
    ed.value = content;
    UI.toast("Đã dọn dẹp dòng trống", "success");
    updateStats();
}

function forceRenderHTML() {
    const v = document.getElementById("editor").value;
    if (!v) return;
    const p = new DOMParser();
    const d = p.parseFromString(v, 'text/html');
    document.getElementById("editor").value = getSmartText(d.body).trim();
    UI.toast("HTML Rendered", "success");
    updateStats();
}

function clearEditor() {
    document.getElementById("editor").value = "";
    updateStats();
}

function copyText() {
    const el = document.getElementById("editor");
    el.select();
    navigator.clipboard.writeText(el.value).then(() => UI.toast("Đã copy vào Clipboard", "success"));
}

function downloadText() {
    const c = document.getElementById("editor").value;
    if (!c) return;
    const blob = new Blob([c], {
        type: 'text/plain'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AIO_Result_${Date.now()}.txt`;
    a.click();
}