let editor;
let currentFileName = 'untitled.js';
let currentFolderPath = null;
let lastSaveTime = Date.now();
let expandedFolders = new Set();

// Initialize CodeMirror
document.addEventListener('DOMContentLoaded', () => {
    editor = CodeMirror(document.getElementById('editorContainer'), {
        lineNumbers: true,
        mode: "javascript",
        theme: "default",
        value: "// Ласкаво просимо до редактора коду!\n// You can start coding here...\n",
        indentUnit: 4,
        indentWithTabs: false,
        tabSize: 4,
        lineWrapping: true,
        autoCloseTags: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        styleActiveLine: true,
        highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true },
        extraKeys: {
            "Ctrl-S": saveFile,
            "Cmd-S": saveFile,
            "Ctrl-F": "find",
            "Cmd-F": "find",
            "Ctrl-H": "replace",
            "Cmd-H": "replace",
            "Ctrl-B": toggleSidebar,
            "Cmd-B": toggleSidebar,
            "F11": toggleFullScreen,
            "Esc": exitFullScreen
        }
    });

    // Update status bar on cursor change
    editor.on('cursorActivity', updateStatus);
    editor.on('change', () => {
        updateStatus();
        autoSave();
    });

    // Setup event listeners
    setupEventListeners();
    loadInitialFile();
});

function setupEventListeners() {
    document.getElementById('openFolderBtn').addEventListener('click', openFolder);
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
}

async function openFolder() {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
        currentFolderPath = folderPath;
        expandedFolders.clear();
        expandedFolders.add(folderPath);
        loadFolderContents(folderPath);
    }
}

async function loadFolderContents(folderPath) {
    const files = await window.electronAPI.readDirectory(folderPath);
    const fileTree = document.getElementById('fileTree');
    fileTree.innerHTML = '';
    
    if (files.length === 0) {
        fileTree.innerHTML = '<p class="empty-state">Folder is empty</p>';
        return;
    }

    files.forEach(file => {
        const fileItem = createFileItem(file, 0);
        fileTree.appendChild(fileItem);
    });
}

function createFileItem(file, depth) {
    const container = document.createElement('div');
    
    if (file.isDirectory) {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'file-item';
        folderDiv.dataset.path = file.path;
        folderDiv.style.paddingLeft = (12 + depth * 16) + 'px';
        
        const toggle = document.createElement('button');
        toggle.className = 'file-item-toggle';
        toggle.textContent = expandedFolders.has(file.path) ? '▼' : '▶';
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFolder(file.path, toggle, folderDiv.parentElement, folderDiv);
        });
        
        const icon = document.createElement('span');
        icon.className = 'file-item-icon';
        icon.textContent = '📁';
        
        const name = document.createElement('span');
        name.className = 'file-item-name';
        name.textContent = file.name;
        
        folderDiv.appendChild(toggle);
        folderDiv.appendChild(icon);
        folderDiv.appendChild(name);
        
        container.appendChild(folderDiv);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'file-children';
        childrenContainer.dataset.parent = file.path;
        if (!expandedFolders.has(file.path)) {
            childrenContainer.classList.add('collapsed');
        } else {
            // populate children when directory initially expanded
            loadSubfolder(file.path, childrenContainer, depth + 1);
        }

        container.appendChild(childrenContainer);
    } else {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        fileDiv.dataset.path = file.path;
        fileDiv.style.paddingLeft = (28 + depth * 16) + 'px';
        
        const icon = document.createElement('span');
        icon.className = 'file-item-icon';
        icon.textContent = getFileIcon(file.name);
        
        const name = document.createElement('span');
        name.className = 'file-item-name';
        name.textContent = file.name;
        
        fileDiv.appendChild(icon);
        fileDiv.appendChild(name);
        
        fileDiv.addEventListener('click', (e) => {
            openFileFromExplorer(file.path, file.name);
        });
        
        container.appendChild(fileDiv);
    }
    
    return container;
}

async function loadSubfolder(folderPath, parentElement, depth) {
    // parentElement is expected to be the .file-children container
    // avoid re-populating if already has children
    if (!parentElement || parentElement.querySelector('.file-item')) return;

    const files = await window.electronAPI.readDirectory(folderPath);
    
    files.forEach(file => {
        const fileItem = createFileItem(file, depth);
        parentElement.appendChild(fileItem);
    });
}

function toggleFolder(folderPath, toggleBtn, parentContainer, folderDiv) {
    const isExpanded = expandedFolders.has(folderPath);
    const childrenContainer = folderDiv.nextElementSibling;

    if (isExpanded) {
        // collapse: mark collapsed and remove expanded flag
        expandedFolders.delete(folderPath);
        toggleBtn.textContent = '▶';
        if (childrenContainer && childrenContainer.classList.contains('file-children')) {
            childrenContainer.classList.add('collapsed');
        }
    } else {
        // expand: populate once and show
        expandedFolders.add(folderPath);
        toggleBtn.textContent = '▼';
        if (childrenContainer && childrenContainer.classList.contains('file-children')) {
            // if not populated, loadSubfolder will populate
            if (!childrenContainer.querySelector('.file-item')) {
                loadSubfolder(folderPath, childrenContainer, getDepth(folderDiv) + 1);
            }
            childrenContainer.classList.remove('collapsed');
        }
    }
}

function getDepth(element) {
    return Math.floor((parseInt(element.style.paddingLeft) - 12) / 16);
}

async function openFileFromExplorer(filePath, fileName) {
    currentFileName = fileName;
    const result = await window.electronAPI.readFile(filePath);
    
    if (result.success) {
        editor.setValue(result.content);
        detectLanguageFromFileName(fileName);
        updateStatusMessage(`✓ Loaded: ${fileName}`);
        
        // Update active state in file tree
        document.querySelectorAll('.file-item.active').forEach(el => el.classList.remove('active'));
        try {
            // prefer data-path matching
            const selector = `.file-item[data-path="${filePath.replace(/"/g, '\\"')}"]`;
            const el = document.querySelector(selector);
            if (el) el.classList.add('active');
        } catch (e) {
            // fallback: try by filename match (best-effort)
            const els = Array.from(document.querySelectorAll('.file-item'));
            const found = els.find(x => x.querySelector('.file-item-name') && x.querySelector('.file-item-name').textContent === fileName);
            if (found) found.classList.add('active');
        }
    } else {
        updateStatusMessage(`✗ Error loading file: ${result.error}`);
    }
}

function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
        'js': '📜',
        'jsx': '⚛️',
        'ts': '📘',
        'tsx': '⚛️',
        'py': '🐍',
        'html': '🌐',
        'css': '🎨',
        'json': '{ }',
        'xml': '📄',
        'rb': '💎',
        'php': '🐘',
        'go': '🐹',
        'java': '☕',
        'c': '⚙️',
        'cpp': '⚙️',
        'txt': '📝',
        'md': '📋'
    };
    return iconMap[ext] || '📄';
}

function updateStatus() {
    const coords = editor.getCursor();
    document.getElementById('coords').textContent = 
        `Line ${coords.line + 1}, Col ${coords.ch + 1} | Lines: ${editor.lineCount()}`;
}

function saveFile() {
    const data = editor.getValue();
    const blob = new Blob([data], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = currentFileName;
    a.click();
    
    updateStatusMessage(`✓ Saved as ${currentFileName}`);
    lastSaveTime = Date.now();
}

function loadFile() {
    const fileInput = document.getElementById('fileInput');
    fileInput.click();
    
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            currentFileName = file.name;
            const reader = new FileReader();
            reader.onload = (event) => {
                editor.setValue(event.target.result);
                detectLanguageFromFileName(file.name);
                updateStatusMessage(`✓ Loaded: ${file.name}`);
            };
            reader.readAsText(file);
        }
    };
}

function newFile() {
    if (editor.getValue().length > 0) {
        if (!confirm('Create new file? Any unsaved changes will be lost.')) {
            return;
        }
    }
    editor.setValue('// New file\n');
    currentFileName = 'untitled.js';
    editor.setOption('mode', 'javascript');
    updateStatusMessage('New file created');
}

function detectLanguageFromFileName(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const langMap = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'javascript',
        'tsx': 'javascript',
        'py': 'python',
        'html': 'htmlmixed',
        'css': 'css',
        'json': 'json',
        'xml': 'xml',
        'rb': 'ruby',
        'php': 'php',
        'go': 'go',
        'java': 'text/x-java',
        'c': 'text/x-csrc',
        'cpp': 'text/x-c++src',
        'md': 'text/x-markdown'
    };
    
    const mode = langMap[ext] || 'javascript';
    editor.setOption('mode', mode);
}

function toggleFullScreen() {
    editor.setOption('fullScreen', !editor.getOption('fullScreen'));
}

function exitFullScreen() {
    if (editor.getOption('fullScreen')) {
        editor.setOption('fullScreen', false);
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('hidden');
}

function autoSave() {
    const now = Date.now();
    if (now - lastSaveTime > 30000) {
        lastSaveTime = now;
    }
}

function loadInitialFile() {
    const savedCode = localStorage.getItem('editorCode');
    if (savedCode) {
        editor.setValue(savedCode);
        updateStatusMessage('Recovered previous session');
    }
}

function updateStatusMessage(message) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    setTimeout(() => {
        statusEl.textContent = 'Ready';
    }, 3000);
}

// Save to localStorage before closing
window.addEventListener('beforeunload', () => {
    localStorage.setItem('editorCode', editor.getValue());
});

// Keyboard shortcut hints
console.log(`
🎮 Keyboard Shortcuts:
Ctrl/Cmd + S   → Save file
Ctrl/Cmd + F   → Find
Ctrl/Cmd + H   → Find & Replace
Ctrl/Cmd + B   → Toggle sidebar
F11            → Fullscreen
ESC            → Exit fullscreen
`);