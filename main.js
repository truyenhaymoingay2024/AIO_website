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

let _statsDebounceTimer = null;
const STATS_DEBOUNCE_MS = 400; // Chỉ tính lại từ/dòng sau khi ngừng gõ 400ms, tránh treo UI với văn bản lớn

function onEditorInput() {
    searchState.isDirty = true;

    // Cập nhật số ký tự ngay lập tức (rẻ, O(1)) để UI vẫn phản hồi tức thì
    const text = document.getElementById('editor').value;
    updateCharCountOnly(text.length);

    // Việc đếm từ/dòng (split trên toàn bộ text) rất tốn kém với văn bản lớn
    // (vài trăm nghìn - vài triệu ký tự) nếu chạy trên MỖI phím gõ.
    // Debounce lại để chỉ tính khi người dùng tạm ngừng gõ.
    clearTimeout(_statsDebounceTimer);
    _statsDebounceTimer = setTimeout(updateStats, STATS_DEBOUNCE_MS);
}

function updateCharCountOnly(charCount) {
    const el = document.getElementById('charCount');
    // Giữ nguyên phần dòng/từ/thời gian cũ (nếu có), chỉ thay số ký tự để tránh nhấp nháy sai số
    const current = el.dataset.lastFull;
    if (current) {
        el.innerHTML = current.replace(/[\d.,]+(?= ký tự)/, charCount.toLocaleString());
    } else {
        el.innerHTML = `<span style="color:var(--text-muted)">... | ${charCount.toLocaleString()} ký tự | <span style="color:var(--primary)">🎧 ~...</span></span>`;
    }
}

function updateStats() {
    const text = document.getElementById('editor').value;
    const charCount = text.length;
    
    // Đếm số từ, số dòng
    const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    // CodeMirror đã tự theo dõi số dòng nội bộ (O(1)) - dùng lại thay vì split() toàn bộ text lần nữa
    const lineCount = window.cmEditor ? window.cmEditor.lineCount() : (text === '' ? 0 : text.split(/\n/).length);

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

    const html = `<span style="color:var(--text-muted)">${lineCount.toLocaleString()} dòng | ${wordCount.toLocaleString()} từ | ${charCount.toLocaleString()} ký tự | <span style="color:var(--primary)">🎧 ~${timeStr}</span></span>`;
    const el = document.getElementById('charCount');
    el.innerHTML = html;
    el.dataset.lastFull = html;
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

/* ================= DRAWER MENU (MOBILE) ================= */
// Trên mobile, 2 tab "Lấy dữ liệu" và "Tìm kiếm & Thay thế" được gom vào 1
// drawer trượt ra từ cạnh trái, mở/đóng bằng nút hamburger trên header.
// Khi drawer đóng lại, Text Editor chiếm trọn màn hình chính.
const sidebarEl = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

function openSidebar() {
    sidebarEl.classList.add('open');
    sidebarBackdrop.classList.add('show');
    // Đang mở menu công cụ thì ẩn thanh tìm kiếm nổi để tránh trùng lặp điều khiển
    refreshFloatingSearchBar();
}

function closeSidebar() {
    sidebarEl.classList.remove('open');
    sidebarBackdrop.classList.remove('show');
    // Quay lại Text Editor: nếu đang có kết quả tìm kiếm thì hiện lại thanh nổi
    refreshFloatingSearchBar();
}

function toggleSidebar() {
    if (sidebarEl.classList.contains('open')) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

document.getElementById('btnMenuToggle').addEventListener('click', toggleSidebar);
document.getElementById('btnSidebarClose').addEventListener('click', closeSidebar);
sidebarBackdrop.addEventListener('click', closeSidebar);

/* ================= THANH TÌM KIẾM NỔI (FLOATING SEARCH BAR) ================= */
// Hiện khi: có ít nhất 1 kết quả tìm kiếm VÀ drawer đang đóng (tức người dùng
// đã quay lại xem/chỉnh Text Editor). Cho phép duyệt trước/sau và thay thế
// ngay trên Text Editor mà không cần mở lại menu.
function refreshFloatingSearchBar() {
    const bar = document.getElementById('floatingSearchBar');
    if (!bar) return;
    const hasMatches = searchState.matches.length > 0;
    const drawerOpen = sidebarEl.classList.contains('open');
    if (hasMatches && !drawerOpen) {
        bar.classList.add('show');
        document.getElementById('floatingNavCounter').innerText = document.getElementById('navCounter').innerText;
    } else {
        bar.classList.remove('show');
    }
}

function dismissFloatingSearchBar() {
    document.getElementById('floatingSearchBar').classList.remove('show');
}

/* ================= CODEMIRROR: EDITOR ẢO HÓA (VIRTUALIZED) ================= */
// Vấn đề gốc: <textarea> chuẩn HTML luôn giữ TOÀN BỘ nội dung trong DOM và
// buộc trình duyệt tính lại layout/shaping cho cả khối mỗi khi có thay đổi.
// Với văn bản 1 triệu+ ký tự, trên phần cứng yếu (đặc biệt GPU/driver yếu
// trên Linux) việc này gây đứng máy thật sự khi gõ.
//
// CodeMirror chỉ dựng (render) phần đang hiển thị trong khung nhìn + một
// vùng đệm nhỏ xung quanh (viewportMargin), bất kể văn bản dài bao nhiêu.
// Quan trọng hơn: vùng nhập liệu ẩn (hidden input) CodeMirror dùng để bắt
// phím gõ chỉ chứa một đoạn nhỏ quanh con trỏ, KHÔNG chứa toàn bộ tài liệu
// -> trình duyệt không còn phải shaping/spellcheck cả triệu ký tự mỗi lần
// gõ 1 phím nữa. Đây là nguyên nhân cốt lõi khiến việc gõ bị đứng, và
// CodeMirror giải quyết tận gốc, không phải là giảm nhẹ triệu chứng.
const editorTextareaEl = document.getElementById('editor');

const cmEditor = CodeMirror.fromTextArea(editorTextareaEl, {
    mode: null,             // Văn bản thuần, không cần tô cú pháp -> đỡ tốn CPU
    lineWrapping: true,     // Tương đương white-space: pre-wrap trước đây
    lineNumbers: false,     // Giữ giao diện như cũ
    viewportMargin: 30,     // Chỉ render thêm ~30 dòng ngoài khung nhìn (KHÔNG dùng Infinity,
                            // vì Infinity sẽ ép render toàn bộ tài liệu -> mất hết ý nghĩa ảo hóa)
    spellcheck: false,
    autofocus: false,
    dragDrop: false,        // Tắt xử lý kéo-thả mặc định của CodeMirror, dùng logic kéo-thả riêng của app bên dưới
    undoDepth: 200
});
window.cmEditor = cmEditor;

// ---- CẦU NỐI TƯƠNG THÍCH ----
// Toàn bộ code xử lý văn bản có sẵn của app (formatWattpad, smartJoin,
// removeEmptyLines, search/replace, v.v...) đang thao tác trực tiếp qua
// document.getElementById('editor').value/.selectionStart/.setSelectionRange()/
// .setRangeText()/.focus(). Thay vì sửa lại từng hàm, ta định nghĩa lại các
// thuộc tính/phương thức đó ngay trên phần tử textarea gốc (giờ đã bị
// CodeMirror ẩn đi) để tự động chuyển tiếp sang CodeMirror. Nhờ vậy toàn bộ
// phần còn lại của main.js không cần đổi một dòng nào.
Object.defineProperty(editorTextareaEl, 'value', {
    get() { return cmEditor.getValue(); },
    set(v) { cmEditor.setValue(v || ''); }
});

Object.defineProperty(editorTextareaEl, 'selectionStart', {
    get() { return cmEditor.indexFromPos(cmEditor.getCursor('from')); }
});

Object.defineProperty(editorTextareaEl, 'selectionEnd', {
    get() { return cmEditor.indexFromPos(cmEditor.getCursor('to')); }
});

editorTextareaEl.setSelectionRange = function (start, end) {
    cmEditor.setSelection(cmEditor.posFromIndex(start), cmEditor.posFromIndex(end));
};

editorTextareaEl.setRangeText = function (text, start, end) {
    cmEditor.replaceRange(text, cmEditor.posFromIndex(start), cmEditor.posFromIndex(end));
};

editorTextareaEl.focus = function () { cmEditor.focus(); };
editorTextareaEl.select = function () { cmEditor.execCommand('selectAll'); };

// Thay cho oninput="onEditorInput()" trên textarea gốc (đã bị ẩn nên không còn nhận sự kiện input)
cmEditor.on('change', () => onEditorInput());

// ---- CHẠY TÁC VỤ NẶNG KHÔNG LÀM ĐỨNG UI ----
// Các thao tác xử lý toàn bộ văn bản (lọc, nối, thay thế hàng loạt...) vẫn
// là O(n) theo độ dài văn bản - với 1 triệu+ ký tự có thể mất vài trăm ms.
// deferHeavy() nhường lại 1 nhịp cho trình duyệt vẽ xong trạng thái UI
// (log "đang xử lý") TRƯỚC KHI chạy tác vụ chặn main thread, để người dùng
// thấy phản hồi ngay khi bấm nút thay vì cảm giác đứng máy.
function deferHeavy(fn) {
    const len = editorTextareaEl.value.length;
    if (len > 150000) {
        UI.log('⏳ Đang xử lý văn bản lớn, vui lòng đợi giây lát...', 'info');
    }
    setTimeout(fn, 30);
}

/* ================= NHẬP FILE .TXT (KÉO-THẢ + NÚT TẢI LÊN) ================= */
const editorWrapper = document.getElementById('editorWrapper');
const editorEle = document.getElementById('editor');

// Hàm dùng chung: đọc 1 file .txt và nạp nội dung vào editor.
// Dùng chung cho cả kéo-thả (desktop) và nút "Tải file lên" (mobile),
// vì trên điện thoại kéo-thả file từ trình quản lý tệp vào trình duyệt
// không tiện lợi như trên máy tính (đây là hạn chế mặc định của nền tảng).
function importTxtFile(file) {
    if (!file) return;

    // Chỉ chấp nhận file .txt (theo đuôi file hoặc MIME type)
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

// --- Kéo & thả (chủ yếu dành cho desktop) ---
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
        importTxtFile(e.dataTransfer.files[0]);
    }
});

// --- Nút "Tải file lên" (chủ yếu dành cho mobile, nhưng dùng tốt trên mọi thiết bị) ---
const btnUploadFile = document.getElementById('btnUploadFile');
const fileInput = document.getElementById('fileInput');

btnUploadFile.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        importTxtFile(e.target.files[0]);
    }
    // Reset value để có thể chọn lại đúng file đó ở lần sau (đổi thì mới bắn sự kiện change)
    fileInput.value = '';
});


/* ================= KEYBOARD SHORTCUTS ================= */

// Dùng chung cho Enter (trong ô Tìm/Thay) và F3: nếu kết quả tìm kiếm đã cũ
// (hoặc chưa tìm lần nào) thì tìm lại từ đầu, ngược lại thì duyệt tới/lui.
function navigateOrInitSearch(dir) {
    if (searchState.isDirty || searchState.matches.length === 0) {
        initSearch();
    } else {
        navMatch(dir);
    }
}

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

    // F3 / Shift+F3: Duyệt kết quả tới/lui (giống Find Next/Previous của trình duyệt),
    // hoạt động từ bất kỳ đâu trên tab Tìm kiếm & Thay thế, không cần focus vào ô Tìm.
    if (e.key === 'F3' && document.getElementById('tab-search').classList.contains('active')) {
        e.preventDefault();
        navigateOrInitSearch(e.shiftKey ? -1 : 1);
    }

    // Ctrl + Shift + Enter: Thay thế HIỆN TẠI (tách riêng khỏi Ctrl+Enter = Thay thế Hết)
    if (isCtrl && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        if (document.getElementById('tab-search').classList.contains('active')) {
            replaceOne();
        }
        return;
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

// Sự kiện riêng cho ô Find: Enter / Shift+Enter = duyệt tới/lui
document.getElementById('findStr').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); // Tránh tạo dòng mới trong textarea
        navigateOrInitSearch(e.shiftKey ? -1 : 1);
    }
});

// Sự kiện riêng cho ô Thay thế bằng: Enter thường = duyệt tới (Shift+Enter vẫn để
// xuống dòng, phòng khi cần nội dung thay thế nhiều dòng).
document.getElementById('replaceStr').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        navigateOrInitSearch(1);
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

/* ================= AUDIO SCRIPT FORMATTER ================= */
function insertAudioScripts() {
    const editor = document.getElementById("editor");
    let text = editor.value;
    
    if (!text.trim()) return UI.toast("Không có nội dung để chèn!", "warn");

    // Các đoạn text cấu hình
    const introText = "Chào mừng bạn đã quay trở lại với Tư Ngữ Audio. Hôm nay, chúng ta sẽ cùng nhau đến với . Và nếu bạn yêu thích những bộ truyện trên kênh, thì đừng quên nhấn like và đăng ký kênh để ủng hộ mình nhé. Ngoài ra, bạn cũng có thể tiếp thêm động lực cho Tư Ngữ Audio bằng cách quét mã QR trên video hoặc link donate ở dưới phần mô tả. Mình trân trọng mọi sự ủng hộ từ bạn. Cảm ơn bạn rất nhiều. Rồi, bây giờ chúng ta cùng bắt đầu nhé!";
    
    const outroText = "Cảm ơn bạn đã lắng nghe đến những phút cuối cùng của video này. Không biết những chương truyện hôm nay để lại trong bạn cảm xúc như thế nào? Nếu có thể, bạn hãy để lại một lượt like và vài dòng bình luận chia sẻ cảm nhận nha, mình luôn đọc và trân trọng từng lời của bạn. Và đừng quên đăng ký kênh và bật chuông thông báo để không bỏ lỡ những chương truyện mới mỗi ngày nhé. Chúc bạn luôn an yên và có thật nhiều khoảnh khắc nhẹ nhàng cùng Tư Ngữ Audio.";
    
    const msgDonate = "Bạn có thể ủng hộ mình qua link ủng hộ dưới phần mô tả hoặc mã QR trên video để tiếp thêm động lực cho mình nha.";
    const msgLikeSub = "Nếu bạn yêu thích nội dung kênh mang đến thì nhớ like video và đăng ký kênh nha.";

    // Tách dòng để xử lý
    let lines = text.split('\n');
    let newLines = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Dùng Regex tìm các dòng bắt đầu bằng "Chương " theo sau là số
        // \s* cho phép có khoảng trắng đầu dòng, /i để không phân biệt hoa thường
        let match = line.match(/^\s*\[?Chương\s+(\d+)/i); 

        if (match) {
            let num = parseInt(match[1], 10);
            
            // Điều kiện số bé hơn 10000
            if (num < 10000) {
                // Đuôi là 1 (chia lấy dư cho 10 bằng 1)
                if (num % 10 === 1) {
                    newLines.push(msgLikeSub);
                    newLines.push(""); // Thêm 1 dòng trống cho dễ nhìn
                } 
                // Đuôi là 6 (chia lấy dư cho 10 bằng 6)
                else if (num % 10 === 6) {
                    newLines.push(msgDonate);
                    newLines.push(""); // Thêm 1 dòng trống cho dễ nhìn
                }
            }
        }
        newLines.push(line);
    }

    // Nối văn bản: Intro -> Nội dung đã chèn -> Outro
    let finalOutput = introText + "\n\n" + newLines.join('\n') + "\n\n" + outroText;

    // Dọn dẹp khoảng trắng dư thừa (nếu có quá nhiều dòng trống liên tiếp do nối)
    finalOutput = finalOutput.replace(/\n{4,}/g, '\n\n\n');

    // Cập nhật lại vào khung Editor
    editor.value = finalOutput;
    
    // Cập nhật thống kê và lưu trạng thái
    updateStats();
    if (typeof searchState !== 'undefined') searchState.isDirty = true;
    
    UI.toast("Đã chèn Kịch Bản Audio thành công!", "success");
    UI.log("Đã tự động chèn Intro, Outro và các lời kêu gọi (đuôi 1, 6).", "success");
}

// ========== EXPORT / IMPORT PRESETS ==========
function exportPresets() {
    if (appPresets.length === 0) {
        return UI.toast("Không có quy tắc nào để xuất!", "warn");
    }
    // Format: find|||replace|||isRegex
    const lines = appPresets.map(p => {
        return `${p.find}|||${p.replace}|||${p.isRegex ? 'true' : 'false'}`;
    });
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aio_presets_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast(`Đã xuất ${appPresets.length} quy tắc thành file .txt`, "success");
}

function importPresetsFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target.result;
            const lines = content.split(/\r?\n/);
            let addedCount = 0;
            for (let line of lines) {
                line = line.trim();
                if (line === '') continue;
                const parts = line.split('|||');
                if (parts.length !== 3) {
                    UI.log(`Dòng bỏ qua (không đúng định dạng): ${line.substring(0, 50)}`, 'warn');
                    continue;
                }
                const [find, replace, isRegexStr] = parts;
                const isRegex = isRegexStr === 'true';
                if (isRegex) {
                    try {
                        new RegExp(find);
                    } catch (err) {
                        UI.log(`Regex không hợp lệ, bỏ qua: ${find}`, 'error');
                        continue;
                    }
                }
                appPresets.push({ find, replace, isRegex });
                addedCount++;
            }
            if (addedCount > 0) {
                localStorage.setItem('aio_presets', JSON.stringify(appPresets));
                renderPresets();
                UI.toast(`Đã nhập thành công ${addedCount} quy tắc mới!`, "success");
                UI.log(`Nhập bộ lọc: thêm ${addedCount} rule.`, "success");
            } else {
                UI.toast("Không có quy tắc hợp lệ nào được thêm.", "warn");
            }
        };
        reader.onerror = () => UI.toast("Lỗi đọc file!", "error");
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
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
        // Có kết quả -> tự động đóng drawer, đưa người dùng quay lại Text Editor
        // để thấy ngay đoạn khớp đầu tiên cùng thanh điều hướng nổi (trước/sau, thay thế).
        closeSidebar();
    } else {
        searchState.currentIndex = -1;
        document.getElementById('navCounter').innerText = "0 / 0";
        refreshFloatingSearchBar();
        UI.toast("Không tìm thấy kết quả nào", "warn");
    }
}

function updateNavUI() {
    const current = searchState.currentIndex + 1;
    const total = searchState.matches.length;
    document.getElementById('navCounter').innerText = `${current} / ${total}`;
    refreshFloatingSearchBar();
}

function scrollToMatch(start, end) {
    // CodeMirror biết chính xác tọa độ dòng/cột của vị trí start/end mà không
    // cần dựng lại (render) phần văn bản phía trước để đo - rẻ hơn nhiều so
    // với kỹ thuật "mirror div" cũ (vốn phải copy + đo layout cả khối văn bản
    // trước vị trí khớp, có thể gần 1 triệu ký tự mỗi lần nhảy kết quả).
    const from = cmEditor.posFromIndex(start);
    const to = cmEditor.posFromIndex(end);
    cmEditor.scrollIntoView({ from, to }, 100);
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
            refreshFloatingSearchBar();
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
        refreshFloatingSearchBar();
        searchState.isDirty = true;
        updateStats();
    }
}

/* ================= DECODE OBFUSCATED HTML (float left/right) ================= */
// Giải mã các span float trong PHẠM VI 1 node (thường là 1 thẻ <p>), trả về
// 1 chuỗi văn bản duy nhất cho đoạn đó (chưa có \n).
function decodeFloatSpansIn(root) {
    const spans = root.querySelectorAll('span[style*="float: left"], span[style*="float: right"], span[style*="float:left"], span[style*="float:right"]');
    if (spans.length === 0) return '';

    // Gom các span theo container cha (inline-block)
    const containerMap = new Map();
    spans.forEach(span => {
        let container = span.parentElement;
        // Nếu container không phải span hoặc không có inline-block, dùng chính span
        if (!container || container.tagName !== 'SPAN' || !container.style.display?.includes('inline-block')) {
            container = span;
        }
        if (!containerMap.has(container)) containerMap.set(container, []);
        const style = span.getAttribute('style') || '';
        const isLeft = style.includes('float: left') || style.includes('float:left');
        const isRight = style.includes('float: right') || style.includes('float:right');
        let type = 'unknown';
        if (isLeft) type = 'left';
        else if (isRight) type = 'right';
        const text = span.textContent || '';
        if (text) containerMap.get(container).push({ text, type });
    });

    // Lấy danh sách container theo thứ tự xuất hiện trong DOM (trong phạm vi root)
    const containerNodes = [];
    const seen = new Set();
    root.querySelectorAll('span').forEach(span => {
        if (containerMap.has(span) && !seen.has(span)) {
            seen.add(span);
            containerNodes.push(span);
        }
    });
    if (containerNodes.length === 0) {
        containerMap.forEach((_, container) => containerNodes.push(container));
    }

    // Ghép từng container: left theo thứ tự, right đảo ngược
    let resultParts = [];
    containerNodes.forEach(container => {
        const items = containerMap.get(container) || [];
        if (items.length === 0) return;
        const leftItems = items.filter(item => item.type === 'left');
        const rightItems = items.filter(item => item.type === 'right');
        const leftText = leftItems.map(item => item.text).join('');
        const rightText = rightItems.map(item => item.text).reverse().join('');
        const combined = leftText + rightText;
        if (combined) resultParts.push(combined);
    });

    return resultParts.join(' ');
}

function decodeObfuscatedHtml(htmlString) {
    if (!htmlString || htmlString.trim() === '') return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // Tìm tất cả span có float left/right
    const allSpans = doc.querySelectorAll('span[style*="float: left"], span[style*="float: right"], span[style*="float:left"], span[style*="float:right"]');
    if (allSpans.length === 0) {
        // Không có obfuscate: vẫn tách đoạn theo <p> để giữ dòng trống giữa các đoạn
        const paras = Array.from(doc.querySelectorAll('p'))
            .map(p => (p.textContent || '').trim())
            .filter(Boolean);
        return paras.length > 0 ? paras.join('\n\n') : (doc.body.textContent || '');
    }

    // Có <p>: giải mã riêng từng <p> rồi nối các đoạn bằng 1 dòng trống.
    // Không có <p> (obfuscate tràn lan ở body): giải mã cả khối như 1 đoạn.
    const pNodes = Array.from(doc.querySelectorAll('p'));
    let finalText;
    if (pNodes.length > 0) {
        const paragraphs = pNodes
            .map(p => decodeFloatSpansIn(p) || p.textContent || '')
            .map(t => t.trim())
            .filter(Boolean);
        finalText = paragraphs.join('\n\n');
    } else {
        finalText = decodeFloatSpansIn(doc.body);
    }

    // Xử lý entity HTML (nếu còn) mà không làm mất dòng trống giữa các đoạn
    finalText = finalText
        .split('\n\n')
        .map(part => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = part;
            const decodedPart = tempDiv.textContent || tempDiv.innerText || part;
            return decodedPart.replace(/\s+/g, ' ').trim();
        })
        .filter(Boolean)
        .join('\n\n');

    return finalText;
}

/* ================= CORE FETCH LOGIC (có tích hợp giải mã obfuscate) ================= */
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
            
            // 1. Đẩy ra ngoài màn hình
            const isHiddenOffscreen = style.includes('position:absolute') && 
                (style.includes('left:-999') || style.includes('top:-999'));
            
            // 2. Bị đẩy xuống dưới nền
            const isHiddenZIndex = style.includes('z-index:-100') || style.includes('z-index:-999');
            
            // 3. Giấu chữ bằng cách thu nhỏ kích thước
            const isMicroText = style.includes('font-size:0.') || 
                                style.includes('font-size:0px') || 
                                style.includes('line-height:0.');

            if (isHiddenOffscreen || isHiddenZIndex || isMicroText) {
                // SỬA Ở ĐÂY: Trả về thông báo thay vì chuỗi rỗng
                return '\n[ĐÃ XOÁ PHẦN TEXT ẨN]\n'; 
            }
        }
        
        try {
            const computedStyle = window.getComputedStyle(node);
            if (computedStyle && computedStyle.display === 'none') {
                // SỬA Ở ĐÂY: Trả về thông báo thay vì chuỗi rỗng
                return '\n[ĐÃ XOÁ PHẦN TEXT ẨN]\n';
            }
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
        closeSidebar(); // Đóng menu, hiện ngay nội dung vừa fetch trên Text Editor
        
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
                    if (el.outerHTML.includes(hiddenRule) || el.className?.includes(hiddenRule)) {
                        // Tạo một Text Node chứa thông báo và thay thế cho thẻ HTML rác
                        const textNode = doc.createTextNode('\n[ĐÃ XOÁ PHẦN TEXT ẨN]\n');
                        if (el.parentNode) {
                            el.parentNode.replaceChild(textNode, el);
                        }
                    }
                });
            } catch {}
        }

        let text = "";

        // ===== 1. Xác định đúng (các) node mục tiêu theo lựa chọn của người dùng TRƯỚC =====
        let targetNodes = [];
        if (type === 'custom' && selector) {
            targetNodes = Array.from(doc.querySelectorAll(selector));
        } else if (type === 'truyenfull') {
            targetNodes = [doc.querySelector('#chapter-c')].filter(Boolean);
        } else if (type === 'wattpadvn') {
            targetNodes = [doc.querySelector('.truyen')].filter(Boolean);
        } else {
            targetNodes = [doc.body];
        }

        // ===== 2. KIỂM TRA OBFUSCATE (float left/right) CHỈ TRONG PHẠM VI NODE ĐÃ CHỌN =====
        // (trước đây kiểm tra trên toàn bộ html thô -> dễ bị "dính" bởi float:left/right
        //  nằm ở quảng cáo/widget khác trên trang, khiến selector/tag/class bị bỏ qua)
        const scopeHtml = targetNodes.map(n => n.outerHTML || '').join('');
        const isObfuscated = scopeHtml.includes('float: left') && scopeHtml.includes('float: right');

        if (isObfuscated) {
            UI.log('🔍 Phát hiện obfuscate (float left/right) trong vùng nội dung đã chọn → tiến hành giải mã...', 'info');
            const decoded = targetNodes.map(n => decodeFloatSpansIn(n)).filter(Boolean).join('\n\n');
            text = decoded || '';
            if (!text) {
                UI.log('⚠️ Giải mã không thành công, lấy text gốc', 'warn');
                text = targetNodes.map(n => getSmartText(n)).join('\n\n');
            } else {
                UI.log('✅ Giải mã obfuscate thành công.', 'success');
            }
        } else {
            // Xử lý thông thường theo selector (không obfuscate)
            if (type === 'truyenfull') {
                text = (doc.querySelector('.chapter-title')?.textContent || '') + "\n\n" +
                    targetNodes.map(n => getSmartText(n)).join('\n\n');
            } else if (type === 'wattpadvn') {
                text = (doc.querySelector('.current-chapter')?.textContent || '') + "\n\n" +
                    targetNodes.map(n => getSmartText(n)).join('\n\n');
            } else {
                text = targetNodes.map(n => getSmartText(n)).join('\n\n');
            }
        }

        text = text.replace(/\u00A0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        
        // KIỂM TRA XEM LINK CÓ CHỨA TEXT ẨN ĐÃ BỊ XÓA KHÔNG
        let warningLine = "";
        if (text.includes("[ĐÃ XOÁ PHẦN TEXT ẨN]")) {
            warningLine = `[LINK CÓ TEXT ẨN]\n`;
            UI.log(`⚠️ Phát hiện text ẩn tại Link ${i+1}`, 'warn'); // Bật dòng này nếu muốn báo cả ra bảng Log
        }

        // Ghép vào output (Chèn dòng cảnh báo ngay dưới === LINK n ===)
        output += `=== LINK ${i+1} ===\n${warningLine}${text}\n\n========================\n\n`;
        successCount++;
    }

    output = output.replace(/\n{3,}/g, '\n\n');
    editor.value = output;
    updateStats();
    UI.processing(false);
    closeSidebar(); // Đóng menu, hiện ngay nội dung vừa fetch trên Text Editor

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
        if (/^(?:\d{1,4}|10000)$/.test(t)) return false;
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

/* ================= XỬ LÝ TỰ TYT (TÍCH HỢP TỪ XuLyTuTYT.html) ================= */
function processTuTYT() {
    const editor = document.getElementById('editor');
    const input = editor.value;
    if (!input.trim()) {
        return UI.toast('Không có nội dung để xử lý!', 'warn');
    }

    const originalLen = input.length;
    const lines = input.split('\n');
    const resultLines = [];
    let removedChars = 0;

    // Các pattern cần xóa toàn bộ dòng
    const patternStar = /^\*{3}\s+\d+\s+\*{3}$/;   // *** n ***
    const patternC = /^C\s+\d+$/;                // C n
    const patternFraction = /^\d+\/\d+$/;         // x/y

    // Duyệt từng dòng, giữ lại những dòng không khớp pattern
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (patternStar.test(trimmed) || patternC.test(trimmed) || patternFraction.test(trimmed)) {
            // Tính số ký tự đã xóa (bao gồm cả ký tự xuống dòng nếu có)
            removedChars += line.length + (i < lines.length - 1 ? 1 : 0);
            continue; // Bỏ qua dòng này
        }

        resultLines.push(line);
    }

    // Chèn dòng trống giữa các dòng có nội dung (không rỗng)
    const finalLines = [];
    for (let i = 0; i < resultLines.length; i++) {
        finalLines.push(resultLines[i]);
        // Nếu dòng hiện tại không rỗng và dòng tiếp theo cũng không rỗng => chèn dòng trống
        if (
            resultLines[i].trim() !== '' &&
            i + 1 < resultLines.length &&
            resultLines[i + 1].trim() !== ''
        ) {
            finalLines.push('');
        }
    }

    const processedText = finalLines.join('\n');
    const newLen = processedText.length;
    const totalRemoved = originalLen - newLen;

    // Cập nhật vào editor
    editor.value = processedText;
    updateStats();
    searchState.isDirty = true;

    // Thông báo
    UI.toast(`✅ Đã xóa ${totalRemoved.toLocaleString()} ký tự và định dạng lại văn bản.`, 'success');
    UI.log(`[Lọc Tự TYT] Đã xóa ${totalRemoved} ký tự, còn lại ${newLen} ký tự.`, 'success');
}

/* ================= THÊM DẤU CÂU CUỐI DÒNG (TỪ them-dau-cham.html) ================= */
function addPunctuation() {
    const editor = document.getElementById('editor');
    const text = editor.value;
    if (!text) {
        return UI.toast('Không có nội dung để xử lý!', 'warn');
    }

    const lines = text.split('\n');
    let addedCount = 0;
    const changes = [];

    // Các dấu câu được coi là hợp lệ ở cuối dòng
    const punctuation = new Set(['.', ',', '!', '?', ';', ':', '…', '"', "'", ')', ']', '}', '-', '”', '’', '»']);

    // Duyệt qua các dòng có kết thúc bằng xuống hàng (tức không phải dòng cuối cùng nếu văn bản không kết thúc bằng newline)
    for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        const trimmed = line.replace(/\s+$/, ''); // bỏ khoảng trắng cuối để kiểm tra ký tự thực

        // 1. Dòng có nội dung (không rỗng)
        if (trimmed.length === 0) continue;

        // 2. Dòng phải chứa ít nhất một ký tự chữ (theo yêu cầu bổ sung)
        if (!/[a-zA-ZÀ-ỹ]/.test(trimmed)) continue;

        // 3. Ký tự cuối không phải dấu câu
        const lastChar = trimmed[trimmed.length - 1];
        if (!punctuation.has(lastChar)) {
            // Thêm dấu chấm, giữ lại khoảng trắng cuối (nếu có)
            const trailingSpace = line.slice(trimmed.length);
            lines[i] = trimmed + '.' + trailingSpace;
            addedCount++;
            changes.push({ lineno: i + 1, before: line, after: lines[i] });
        }
    }

    if (addedCount === 0) {
        UI.toast('Không có dòng nào cần thêm dấu chấm.', 'info');
        return;
    }

    // Cập nhật lại nội dung
    editor.value = lines.join('\n');
    updateStats();
    searchState.isDirty = true;
    UI.toast(`Đã thêm ${addedCount} dấu chấm vào cuối dòng.`, 'success');
    UI.log(`[Thêm dấu câu] Đã thêm ${addedCount} dấu chấm.`, 'success');
}