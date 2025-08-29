/* Custom JavaScript for Proxmox-MPC documentation */

document.addEventListener('DOMContentLoaded', function() {
  // Add copy button functionality for code blocks
  addCopyButtons();
  
  // Initialize progress bars
  initializeProgressBars();
  
  // Add command highlighting
  highlightConsoleCommands();
  
  // Initialize status badges
  initializeStatusBadges();
});

/**
 * Add copy buttons to code blocks
 */
function addCopyButtons() {
  const codeBlocks = document.querySelectorAll('pre > code');
  
  codeBlocks.forEach(function(codeBlock) {
    const pre = codeBlock.parentNode;
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = 'Copy';
    copyButton.addEventListener('click', function() {
      copyToClipboard(codeBlock.textContent);
      copyButton.textContent = 'Copied!';
      setTimeout(function() {
        copyButton.textContent = 'Copy';
      }, 2000);
    });
    
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    wrapper.appendChild(copyButton);
  });
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(function(err) {
      console.error('Failed to copy text: ', err);
    });
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}

/**
 * Initialize progress bars with animation
 */
function initializeProgressBars() {
  const progressBars = document.querySelectorAll('.progress-bar');
  
  progressBars.forEach(function(progressBar) {
    const fill = progressBar.querySelector('.progress-fill');
    const targetWidth = fill.getAttribute('data-width') || '0%';
    
    // Animate progress bar on scroll into view
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          setTimeout(function() {
            fill.style.width = targetWidth;
          }, 200);
          observer.unobserve(entry.target);
        }
      });
    });
    
    observer.observe(progressBar);
  });
}

/**
 * Highlight console commands in text
 */
function highlightConsoleCommands() {
  const textElements = document.querySelectorAll('p, li');
  
  textElements.forEach(function(element) {
    if (element.querySelector('code')) return; // Skip if already has code elements
    
    let html = element.innerHTML;
    
    // Highlight console commands (starting with proxmox-mpc>)
    html = html.replace(
      /(proxmox-mpc&gt;\s*[^<\n]+)/g,
      '<span class="console-command">$1</span>'
    );
    
    // Highlight CLI commands
    html = html.replace(
      /(npm run cli [^<\n]+)/g,
      '<code>$1</code>'
    );
    
    if (html !== element.innerHTML) {
      element.innerHTML = html;
    }
  });
}

/**
 * Initialize status badges with tooltips
 */
function initializeStatusBadges() {
  const badges = document.querySelectorAll('.status-badge');
  
  badges.forEach(function(badge) {
    const status = badge.classList.contains('completed') ? 'Completed' :
                   badge.classList.contains('in-progress') ? 'In Progress' :
                   badge.classList.contains('planned') ? 'Planned' : 'Unknown';
    
    badge.setAttribute('title', `Status: ${status}`);
  });
}

/**
 * Add keyboard shortcuts
 */
document.addEventListener('keydown', function(event) {
  // Ctrl+K or Cmd+K to focus search
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    const searchInput = document.querySelector('.md-search__input');
    if (searchInput) {
      searchInput.focus();
    }
  }
  
  // Escape to close search
  if (event.key === 'Escape') {
    const searchInput = document.querySelector('.md-search__input');
    if (searchInput && document.activeElement === searchInput) {
      searchInput.blur();
    }
  }
});

/**
 * Add scroll-to-top functionality
 */
function addScrollToTop() {
  const scrollButton = document.createElement('button');
  scrollButton.className = 'scroll-to-top';
  scrollButton.innerHTML = '↑';
  scrollButton.setAttribute('aria-label', 'Scroll to top');
  
  scrollButton.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
  
  document.body.appendChild(scrollButton);
  
  // Show/hide scroll button based on scroll position
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      scrollButton.classList.add('visible');
    } else {
      scrollButton.classList.remove('visible');
    }
  });
}

// Initialize scroll-to-top after DOM is loaded
document.addEventListener('DOMContentLoaded', addScrollToTop);

/**
 * Enhance tables with sorting (if needed)
 */
function enhanceTables() {
  const tables = document.querySelectorAll('.command-table');
  
  tables.forEach(function(table) {
    const headers = table.querySelectorAll('th');
    
    headers.forEach(function(header, index) {
      if (header.textContent.trim() && index > 0) { // Skip first column (usually command names)
        header.style.cursor = 'pointer';
        header.setAttribute('aria-label', 'Click to sort');
        
        header.addEventListener('click', function() {
          sortTable(table, index);
        });
      }
    });
  });
}

/**
 * Simple table sorting function
 */
function sortTable(table, columnIndex) {
  const tbody = table.querySelector('tbody') || table;
  const rows = Array.from(tbody.querySelectorAll('tr')).slice(1); // Skip header row
  
  rows.sort(function(a, b) {
    const aText = a.cells[columnIndex].textContent.trim();
    const bText = b.cells[columnIndex].textContent.trim();
    
    // Try numeric sort first
    const aNum = parseFloat(aText);
    const bNum = parseFloat(bText);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    
    // Fallback to text sort
    return aText.localeCompare(bText);
  });
  
  // Re-append sorted rows
  rows.forEach(function(row) {
    tbody.appendChild(row);
  });
}

/**
 * Add version compatibility indicators
 */
function addVersionIndicators() {
  const versionElements = document.querySelectorAll('[data-version]');
  
  versionElements.forEach(function(element) {
    const version = element.getAttribute('data-version');
    const badge = document.createElement('span');
    badge.className = 'version-badge';
    badge.textContent = `v${version}+`;
    badge.setAttribute('title', `Available from version ${version} onwards`);
    
    element.appendChild(badge);
  });
}

// Initialize additional enhancements
document.addEventListener('DOMContentLoaded', function() {
  enhanceTables();
  addVersionIndicators();
});

/**
 * Console command simulator (for interactive examples)
 */
class ConsoleSimulator {
  constructor(element) {
    this.element = element;
    this.commands = [];
    this.currentIndex = 0;
    this.isRunning = false;
  }
  
  addCommand(command, output, delay = 1000) {
    this.commands.push({ command, output, delay });
  }
  
  async run() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    for (let i = 0; i < this.commands.length; i++) {
      const { command, output, delay } = this.commands[i];
      
      // Add command
      this.addLine(`<span class="prompt">proxmox-mpc></span> ${command}`);
      await this.sleep(500);
      
      // Add output
      if (output) {
        this.addLine(output);
      }
      
      await this.sleep(delay);
    }
    
    this.isRunning = false;
  }
  
  addLine(content) {
    const line = document.createElement('div');
    line.innerHTML = content;
    this.element.appendChild(line);
    this.element.scrollTop = this.element.scrollHeight;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  reset() {
    this.element.innerHTML = '';
    this.isRunning = false;
  }
}

// Make ConsoleSimulator available globally for use in documentation
window.ConsoleSimulator = ConsoleSimulator;

/**
 * Initialize console simulators on the page
 */
document.addEventListener('DOMContentLoaded', function() {
  const simulators = document.querySelectorAll('.console-simulator');
  
  simulators.forEach(function(element) {
    const simulator = new ConsoleSimulator(element);
    
    // Add some default commands (can be customized per element)
    simulator.addCommand('/status', '✅ Connected to Proxmox server<br>📊 15 VMs, 5 containers');
    simulator.addCommand('create vm --name web-01 --cores 2', '✅ VM configuration created');
    simulator.addCommand('/test', '🧪 All tests passed!');
    simulator.addCommand('/apply', '🚀 VM web-01 created successfully!');
    
    // Add play button
    const playButton = document.createElement('button');
    playButton.textContent = '▶ Run Demo';
    playButton.className = 'demo-play-button';
    playButton.addEventListener('click', function() {
      simulator.reset();
      simulator.run();
    });
    
    element.parentNode.insertBefore(playButton, element);
  });
});