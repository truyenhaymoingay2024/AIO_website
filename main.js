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
    // Đánh dấu editor đã bị thay đổi, cần scan lại khi tìm kiếm
    searchState.isDirty = true;
    updateStats();
}

function updateStats() {
    const len = document.getElementById('editor').value.length;
    document.getElementById('charCount').innerText = `${len.toLocaleString()} chars`;
}

function toggleConfig() {
    const type = document.querySelector('input[name="sourceType"]:checked').value;
    document.getElementById('customConfigBox').style.display = (type === 'custom') ? 'flex' : 'none';
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

/* ================= WATTPAD.COM SPECIFIC FUNCTIONS ================= */
function extractWattpadCOMContent(html, isFirstPage) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let combinedContent = "";

    // 1. Lấy tiêu đề chương (Nếu là trang 1)
    if (isFirstPage) {
        const titleTag = doc.querySelector('h1.h2');
        if (titleTag) {
            combinedContent += titleTag.innerText.trim().toUpperCase() + "\n\n";
        }
    }

    // 2. Lấy nội dung văn bản sạch
    const paragraphs = doc.querySelectorAll('p[data-p-id]');
    paragraphs.forEach(p => {
        let txt = p.innerText.trim();
        if (txt) combinedContent += txt + "\n\n";
    });

    return combinedContent;
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
                    if (i > 0) {
                        UI.log(`  ↳ Trang ${pageNumber}: Proxy ${i+1} thành công!`, 'success');
                    }
                    return html;
                }
            }
        } catch (e) {
            UI.log(`  ⚠️ Proxy ${i+1} failed: ${e.message}`, 'warn');
        }
    }
    return null;
}

async function processWattpadCOMContent(links) {
    const editor = document.getElementById("editor");
    const log = document.getElementById('logBox');

    let output = "";
    let successCount = 0;

    for (let i = 0; i < links.length; i++) {
        const baseUrl = links[i].trim();
        const linkIndex = i + 1;
        UI.log(`[WattpadCOM ${linkIndex}/${links.length}] Xử lý: ${baseUrl}`, "info");

        let fullText = "";
        let page = 1;
        let hasNext = true;
        let lastPageContent = "";
        let pageCount = 0;

        while (hasNext) {
            const currentUrl = page === 1 ? baseUrl : `${baseUrl}/page/${page}`;
            UI.log(`  ↳ Tải trang ${page}...`, "info");

            const html = await fetchWattpadCOM(currentUrl);

            if (html) {
                const pageText = extractWattpadCOMContent(html, page === 1);

                if (pageText.length > 50 && pageText !== lastPageContent) {
                    fullText += pageText;
                    lastPageContent = pageText;
                    pageCount++;

                    if (html.includes(`/page/${page + 1}`)) {
                        page++;
                    } else {
                        hasNext = false;
                    }
                } else {
                    hasNext = false;
                }
            } else {
                UI.log(`  ❌ Lỗi tải trang ${page}`, "error");
                hasNext = false;
            }
            await new Promise(r => setTimeout(r, 200));
        }

        if (fullText.trim()) {
            const formattedResult = `=== LINK ${linkIndex} (${pageCount} trang) ===\n\n${fullText.trim()}\n\n========================\n\n`;
            output += formattedResult;
            successCount++;
            UI.log(`✅ Hoàn thành: ${pageCount} trang`, "success");
        } else {
            output += `\n=== LỖI: ${baseUrl} ===\n\n`;
            UI.log(`❌ Thất bại: không có nội dung`, "error");
        }

        // Cập nhật progress
        document.getElementById('progressBar').style.width = `${Math.round(((i+1)/links.length)*100)}%`;
        document.getElementById('btnText').innerText = `Đang xử lý (${i+1}/${links.length})...`;
    }

    editor.value = output;
    return successCount;
}

/* ================= ADVANCED FIND & REPLACE ENGINE (FIXED) ================= */
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

    // Flag: global (g), dotAll (s), ignoreCase (i)
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
    searchState.isDirty = false; // Đã scan mới nhất

    const count = searchState.matches.length;
    document.getElementById('navControls').classList.add('active');

    if (count > 0) {
        // Tìm match gần con trỏ hiện tại nhất để bắt đầu
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

// --- PIXEL PERFECT SCROLL LOGIC ---
function scrollToMatch(start, end) {
    const editor = document.getElementById('editor');
    const text = editor.value;

    // Tạo một div "gương" (mirror) để đo vị trí chính xác
    const mirror = document.createElement('div');
    const style = window.getComputedStyle(editor);

    // Copy toàn bộ style quan trọng từ textarea sang mirror div
    const props = [
        'font-family', 'font-size', 'font-weight', 'line-height',
        'padding', 'border', 'width', 'white-space', 'word-wrap', 'word-break',
        'box-sizing'
    ];
    props.forEach(p => mirror.style[p] = style[p]);

    // Mirror div phải ẩn nhưng vẫn render để đo được
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.top = '0';
    mirror.style.left = '0';
    mirror.style.overflow = 'hidden'; // Không hiện scrollbar

    // Nội dung trước match
    const beforeText = text.substring(0, start);
    const matchText = text.substring(start, end);

    // Tạo span đánh dấu
    mirror.textContent = beforeText;
    const span = document.createElement('span');
    span.textContent = matchText;
    mirror.appendChild(span);

    document.body.appendChild(mirror);

    // Lấy tọa độ chính xác của span
    const offsetTop = span.offsetTop;
    const editorHeight = editor.clientHeight;

    // Cuộn textarea đến vị trí đó (căn giữa)
    const scrollTarget = offsetTop - (editorHeight / 2) + parseInt(style.paddingTop);

    editor.scrollTo({
        top: scrollTarget > 0 ? scrollTarget : 0,
        behavior: 'smooth'
    });

    // Dọn dẹp
    document.body.removeChild(mirror);
}

function highlightMatch() {
    if (searchState.matches.length === 0) return;
    if (searchState.currentIndex < 0 || searchState.currentIndex >= searchState.matches.length) return;

    const editor = document.getElementById('editor');
    const match = searchState.matches[searchState.currentIndex];

    // 1. Select text
    editor.focus();
    editor.setSelectionRange(match.start, match.end);

    // 2. Custom Scroll logic (Fix lỗi cuộn thiếu)
    scrollToMatch(match.start, match.end);
}

function navMatch(dir) {
    // --- LOGIC XỬ LÝ KHI NGƯỜI DÙNG TỰ SỬA TEXT (Fix lỗi nhảy lung tung) ---
    if (searchState.isDirty) {
        // Nếu text đã bị sửa, scan lại âm thầm để lấy vị trí mới đúng nhất
        const currentPos = document.getElementById('editor').selectionStart;
        searchState.matches = performScan();
        searchState.isDirty = false;

        if (searchState.matches.length === 0) {
            document.getElementById('navCounter').innerText = "0 / 0";
            return;
        }

        // Tìm match tiếp theo dựa trên vị trí con trỏ hiện tại
        // Nếu bấm Next (1): tìm match đầu tiên SAU con trỏ
        // Nếu bấm Prev (-1): tìm match đầu tiên TRƯỚC con trỏ
        if (dir === 1) {
            searchState.currentIndex = searchState.matches.findIndex(m => m.start >= currentPos);
            if (searchState.currentIndex === -1) searchState.currentIndex = 0; // Wrap around
        } else {
            // Tìm match gần nhất phía sau
            for (let i = searchState.matches.length - 1; i >= 0; i--) {
                if (searchState.matches[i].start < currentPos) {
                    searchState.currentIndex = i;
                    break;
                }
            }
            if (searchState.currentIndex === -1) searchState.currentIndex = searchState.matches.length - 1;
        }
    } else {
        // Logic điều hướng bình thường nếu không sửa gì
        if (searchState.matches.length === 0) return;
        searchState.currentIndex += dir;
        if (searchState.currentIndex >= searchState.matches.length) searchState.currentIndex = 0;
        if (searchState.currentIndex < 0) searchState.currentIndex = searchState.matches.length - 1;
    }

    updateNavUI();
    highlightMatch();
}

function replaceOne() {
    // Nếu dirty, phải scan lại trước khi replace để đảm bảo đúng vị trí
    if (searchState.isDirty || searchState.matches.length === 0) {
        initSearch();
        if (searchState.matches.length === 0) return UI.toast("Không tìm thấy gì để thay", "warn");
    }

    if (searchState.currentIndex === -1) return UI.toast("Hãy chọn một kết quả", "warn");

    const editor = document.getElementById('editor');
    const replaceStr = document.getElementById('replaceStr').value;
    const match = searchState.matches[searchState.currentIndex];

    // Thay thế
    editor.setRangeText(replaceStr, match.start, match.end, 'select');
    UI.toast("Đã thay thế", "success");

    // Sau khi thay thế, độ dài văn bản thay đổi -> đánh dấu dirty để lần bấm Next sau sẽ tự re-scan
    searchState.isDirty = true;

    // Cập nhật thống kê
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

/* ================= CORE FETCH LOGIC (UNCHANGED) ================= */
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
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || ['SCRIPT', 'STYLE'].includes(node.tagName)) return '';
        if (node.tagName === 'BR') return '\n\n';
        let content = '';
        node.childNodes.forEach(c => {
            let t = getSmartText(c);
            if (['P', 'DIV', 'H1', 'LI'].includes(c.tagName)) t = '\n\n' + t + '\n\n';
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

    // Nếu là WattpadCOM, dùng logic đặc biệt
    if (type === 'wattpadcom') {
        UI.processing(true, links.length);
        document.getElementById('logBox').innerHTML = '';
        editor.value = "";
        UI.log("🚀 Khởi động hệ thống WattpadCOM...", "info");

        const successCount = await processWattpadCOMContent(links);

        UI.processing(false);
        updateStats();
        UI.log(`🎯 TỔNG KẾT WATTPAD.COM: ${successCount}/${links.length} thành công`,
            successCount === links.length ? "success" : "warn");
        UI.toast(`Hoàn tất! ${successCount}/${links.length} link thành công`,
            successCount === links.length ? "success" : "info");
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
        } else if (type === 'mongtruyen') {
            text = (doc.querySelector('.mdv-san-pham-detail-chuong-title-text')?.textContent || '') + "\n\n" +
                getSmartText(doc.querySelector('#noi_dung_truyen'));
        } else if (type === 'truyenfull') {
            text = (doc.querySelector('.chapter-title')?.textContent || '') + "\n\n" +
                getSmartText(doc.querySelector('#chapter-c'));
        } else if (type === 'wattpadvn') {
            text = (doc.querySelector('.current-chapter')?.textContent || '') + "\n\n" +
                getSmartText(doc.querySelector('.truyen'));
        } else {
            text = getSmartText(doc.body);
        }

        text = text.replace(/\n{3,}/g, '\n\n').trim();
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

        // 1. Loại bỏ các dòng '=== LINK'
        if (t.startsWith('=== LINK')) return false;

        // 2. Các dòng chỉ chứa các ký tự rác (+, *, =)
        if (/^\++$/.test(t) || /^\*+$/.test(t) || /^\=+$/.test(t)) return false;

        // 3. Các dòng chỉ chứa một số 1-1000: /^(?:[1-9]|[1-9]\d|[1-9]\d{2}|1000)$/
        if (/^(?:[1-9]|[1-9]\d|[1-9]\d{2}|1000)$/.test(t)) return false;

        return true; // Giữ lại các dòng còn lại
    });

    const newContent = lines.join('\n');
    const removedLines = oldContent.split('\n').length - lines.length;
    editor.value = newContent;
    UI.toast(`Đã xóa ${removedLines} dòng rác (bao gồm '=== LINK' và dòng đánh số)`, "success");
    updateStats();
}

function injectPromo() {
    const editor = document.getElementById("editor");
    const keywordsInput = document.getElementById("promoKeywords").value;
    if (!editor.value) return UI.toast("Chưa có nội dung trong Editor!", "warn");
    if (!keywordsInput.trim()) return UI.toast("Vui lòng nhập từ khóa vào Box Hiệu Chỉnh!", "warn");
    const keywords = keywordsInput.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
    const promoText = "Nếu bạn yêu thích nội dung này thì nhớ like video và nhấn nút đăng ký kênh để ủng hộ mình nha. Cảm ơn bạn rất nhiều.";
    if (keywords.length === 0) return;
    const lines = editor.value.split('\n');
    let newLines = [];
    let injectCount = 0;
    lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        const match = keywords.some(key => lowerLine.includes(key));
        if (match) {
            newLines.push(promoText);
            injectCount++;
        }
        newLines.push(line);
    });
    editor.value = newLines.join('\n');
    UI.toast(`Đã chèn promo vào ${injectCount} vị trí`, "success");
    updateStats();
}

function formatTYT() {
    const ed = document.getElementById("editor");
    if (!ed.value) return;
    const oldLen = ed.value.length;
    ed.value = ed.value.replace(/[“”"()[\]【】]/g, '');
    UI.toast(`Đã xóa ${oldLen - ed.value.length} ký tự đặc biệt`, "success");
    updateStats();
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