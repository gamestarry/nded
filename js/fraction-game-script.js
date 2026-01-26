// 分数、小数、百分比记忆游戏 - 移动端优化版
// 独立的JavaScript文件，配合fraction-game-style.css使用

document.addEventListener('DOMContentLoaded', function() {
    console.log('分数、小数、百分比记忆游戏加载...');
    
    // Game data - fraction, decimal, percent equivalents
    const gameData = [
        { fraction: '1/2', decimal: '0.5', percent: '50%' },
        { fraction: '1/4', decimal: '0.25', percent: '25%' },
        { fraction: '3/4', decimal: '0.75', percent: '75%' },
        { fraction: '1/5', decimal: '0.2', percent: '20%' },
        { fraction: '1/10', decimal: '0.1', percent: '10%' },
        { fraction: '1/8', decimal: '0.125', percent: '12.5%' },
        { fraction: '1/3', decimal: '0.333…', percent: '33⅓%' },
        { fraction: '2/3', decimal: '0.666…', percent: '66⅔%' }
    ];

    // 关卡配置
    const levelConfigs = {
        1: { // Level 1: Fraction to Decimal & Percent
            fixedColumn: 'fraction',
            answerTypes: ['decimal', 'percent'],
            description: 'Fraction to Decimal & Percent',
            instructions: 'Drag the decimal and percent values to match each fraction.',
            hint: 'Drag answers from the left panel to the empty cells above'
        },
        2: { // Level 2: Decimal to Fraction & Percent
            fixedColumn: 'decimal',
            answerTypes: ['fraction', 'percent'],
            description: 'Decimal to Fraction & Percent',
            instructions: 'Drag the fraction and percent values to match each decimal.',
            hint: 'Drag answers from the left panel to the empty cells above'
        },
        3: { // Level 3: Percent to Fraction & Decimal
            fixedColumn: 'percent',
            answerTypes: ['fraction', 'decimal'],
            description: 'Percent to Fraction & Decimal',
            instructions: 'Drag the fraction and decimal values to match each percent.',
            hint: 'Drag answers from the left panel to the empty cells above'
        },
        4: { // Level 4: All values mixed
            fixedColumn: null,
            answerTypes: ['fraction', 'decimal', 'percent'],
            description: 'All Values Mixed',
            instructions: 'Match equivalent values in each row. The three values in each row must belong together.',
            hint: 'Drag answers to match equivalent values in each row'
        }
    };

    // Game state
    let gameState = {
        currentLevel: 1, // Level 1-4
        currentRound: 1, // Round 1: ordered answers, Round 2: shuffled answers
        totalRounds: 2, // Two rounds per level
        filledCells: 0, // Count of filled cells
        correctRows: 0, // Count of correct rows (用于第四关)
        correctCells: 0, // Count of correct cells (用于前3关)
        incorrectCells: 0, // Count of incorrect cells
        totalCells: 0, // Total cells to fill (depends on level)
        totalRows: gameData.length, // Total rows
        draggedCard: null,
        isCompleted: false,
        // Track which answers are in the bank vs in cells
        cardLocations: {} // cardId -> 'bank' or {row, col}
    };

    // DOM elements
    const answersContainer = document.getElementById('answersContainer');
    const tableBody = document.getElementById('tableBody');
    const tableSection = document.getElementById('tableSection');
    const resetBtn = document.getElementById('resetBtn');
    const nextBtn = document.getElementById('nextBtn');
    const successMessage = document.getElementById('successMessage');
    const roundNumber = document.getElementById('roundNumber');
    const filledCount = document.getElementById('filledCount');
    const totalCount = document.getElementById('totalCount');
    const correctCount = document.getElementById('correctCount');
    const incorrectCount = document.getElementById('incorrectCount');
    const levelDescription = document.getElementById('levelDescription');
    const gameInstructions = document.getElementById('gameInstructions');
    const hintText = document.getElementById('hintText');
    const levelSelector = document.getElementById('levelSelector');

    // ========== 移动端拖拽优化管理器 ==========
    const dragManager = {
        isDragging: false,
        currentElement: null,
        ghostElement: null,
        dragValue: null,
        dragType: null,
        startX: 0,
        startY: 0,
        offsetX: 0,
        offsetY: 0,
        currentX: 0,
        currentY: 0,
        
        // 预缓存的拖放区域数据
        dropZones: [],
        lastHighlightedZone: null,
        
        // 初始化拖拽管理器
        init: function() {
            console.log('初始化拖拽管理器...');
            this.cacheDropZones();
            
            // 监听窗口大小变化，重新缓存拖放区域
            window.addEventListener('resize', () => {
                this.cacheDropZones();
            });
        },
        
        // 预缓存所有可拖放区域的位置信息
        cacheDropZones: function() {
            const dropZoneElements = document.querySelectorAll('.drop-zone:not([data-filled="true"])');
            this.dropZones = Array.from(dropZoneElements).map(zone => {
                const rect = zone.getBoundingClientRect();
                const rowIndex = parseInt(zone.getAttribute('data-row-index'));
                const type = zone.getAttribute('data-type');
                
                return {
                    element: zone,
                    rect: {
                        x: rect.left,
                        y: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                        centerX: rect.left + rect.width / 2,
                        centerY: rect.top + rect.height / 2
                    },
                    rowIndex: rowIndex,
                    type: type,
                    expected: zone.getAttribute('data-expected')
                };
            });
            
            console.log(`缓存了 ${this.dropZones.length} 个拖放区域`);
        },
        
        // 开始拖拽
        startDrag: function(element, clientX, clientY) {
            this.isDragging = true;
            this.currentElement = element;
            this.dragValue = element.getAttribute('data-value');
            this.dragType = element.getAttribute('data-type');
            
            // 获取元素位置
            const rect = element.getBoundingClientRect();
            this.startX = clientX;
            this.startY = clientY;
            this.offsetX = clientX - rect.left;
            this.offsetY = clientY - rect.top;
            this.currentX = rect.left;
            this.currentY = rect.top;
            
            // 创建拖拽幽灵
            this.createDragGhost(element, rect);
            
            // 标记原始元素为拖拽中
            element.classList.add('dragging');
            
            // 添加全局事件监听
            document.addEventListener('pointermove', this.handlePointerMove.bind(this));
            document.addEventListener('pointerup', this.handlePointerUp.bind(this));
            document.addEventListener('pointercancel', this.handlePointerCancel.bind(this));
            
            // 防止文本选择和页面滚动
            document.body.style.userSelect = 'none';
            document.body.style.overflow = 'hidden';
            
            return true;
        },
        
        // 创建拖拽幽灵
        createDragGhost: function(sourceElement, sourceRect) {
            this.ghostElement = sourceElement.cloneNode(true);
            this.ghostElement.classList.add('drag-ghost');
            this.ghostElement.classList.remove('dragging', 'in-bank', 'in-cell');
            
            // 应用样式
            const style = window.getComputedStyle(sourceElement);
            this.ghostElement.style.width = `${sourceRect.width}px`;
            this.ghostElement.style.height = `${sourceRect.height}px`;
            this.ghostElement.style.position = 'fixed';
            this.ghostElement.style.left = '0';
            this.ghostElement.style.top = '0';
            this.ghostElement.style.margin = '0';
            this.ghostElement.style.zIndex = '9999';
            this.ghostElement.style.opacity = '0.9';
            this.ghostElement.style.pointerEvents = 'none';
            
            // 复制关键样式
            this.ghostElement.style.background = style.background;
            this.ghostElement.style.color = style.color;
            this.ghostElement.style.fontSize = style.fontSize;
            this.ghostElement.style.fontWeight = style.fontWeight;
            this.ghostElement.style.borderRadius = style.borderRadius;
            this.ghostElement.style.boxShadow = style.boxShadow;
            this.ghostElement.style.border = style.border;
            this.ghostElement.style.display = 'flex';
            this.ghostElement.style.justifyContent = 'center';
            this.ghostElement.style.alignItems = 'center';
            
            // 添加到文档
            document.body.appendChild(this.ghostElement);
            
            // 强制同步布局
            this.ghostElement.offsetHeight;
            
            // 移动到正确位置
            const transformX = this.startX - this.offsetX;
            const transformY = this.startY - this.offsetY;
            this.ghostElement.style.transform = 
                `translate3d(${transformX}px, ${transformY}px, 0) scale(1.05)`;
        },
        
        // 指针移动处理
        handlePointerMove: function(e) {
            if (!this.isDragging) return;
            
            e.preventDefault();
            
            // 更新当前位置
            this.currentX = e.clientX - this.offsetX;
            this.currentY = e.clientY - this.offsetY;
            
            // 更新幽灵位置
            this.updateDragPosition(e.clientX, e.clientY);
        },
        
        // 更新拖拽位置
        updateDragPosition: function(clientX, clientY) {
            if (!this.isDragging || !this.ghostElement) return;
            
            const transformX = clientX - this.offsetX;
            const transformY = clientY - this.offsetY;
            
            this.ghostElement.style.transform = 
                `translate3d(${transformX}px, ${transformY}px, 0) scale(1.05)`;
            
            // 碰撞检测
            this.checkDropZoneCollision(clientX, clientY);
        },
        
        // 碰撞检测
        checkDropZoneCollision: function(x, y) {
            let currentZone = null;
            let minDistance = Infinity;
            
            // 遍历所有缓存的拖放区域
            for (const zone of this.dropZones) {
                // 快速矩形碰撞检测
                if (x >= zone.rect.x && x <= zone.rect.right &&
                    y >= zone.rect.y && y <= zone.rect.bottom) {
                    
                    // 计算到中心点的距离
                    const distance = Math.sqrt(
                        Math.pow(x - zone.rect.centerX, 2) + 
                        Math.pow(y - zone.rect.centerY, 2)
                    );
                    
                    // 选择最近的区域
                    if (distance < minDistance) {
                        minDistance = distance;
                        currentZone = zone;
                    }
                }
            }
            
            // 更新高亮显示
            this.updateDropZoneHighlight(currentZone);
        },
        
        // 更新拖放区域高亮
        updateDropZoneHighlight: function(zone) {
            // 清除之前的高亮
            if (this.lastHighlightedZone && this.lastHighlightedZone !== zone) {
                this.lastHighlightedZone.element.classList.remove('over');
            }
            
            // 设置新的高亮
            if (zone && zone !== this.lastHighlightedZone) {
                zone.element.classList.add('over');
                this.lastHighlightedZone = zone;
            } else if (!zone && this.lastHighlightedZone) {
                this.lastHighlightedZone.element.classList.remove('over');
                this.lastHighlightedZone = null;
            }
        },
        
        // 结束拖拽
        handlePointerUp: function(e) {
            if (!this.isDragging) return;
            
            e.preventDefault();
            
            // 获取放置位置
            const dropZone = this.lastHighlightedZone;
            const answersContainerRect = answersContainer.getBoundingClientRect();
            
            // 检查是否可以放置
            if (dropZone) {
                // 放置到表格单元格
                dropToTableCell(this.currentElement, dropZone.element);
            } else if (e.clientX >= answersContainerRect.left && 
                       e.clientX <= answersContainerRect.right &&
                       e.clientY >= answersContainerRect.top && 
                       e.clientY <= answersContainerRect.bottom) {
                // 放置回答案栏
                returnToAnswerBank(this.currentElement);
            }
            
            // 清理拖拽状态
            this.endDrag();
        },
        
        // 取消拖拽
        handlePointerCancel: function() {
            if (!this.isDragging) return;
            this.endDrag();
        },
        
        // 结束拖拽（清理）
        endDrag: function() {
            if (!this.isDragging) return;
            
            this.isDragging = false;
            
            // 移除幽灵元素
            if (this.ghostElement) {
                this.ghostElement.remove();
                this.ghostElement = null;
            }
            
            // 清除原始元素的拖拽状态
            if (this.currentElement) {
                this.currentElement.classList.remove('dragging');
                this.currentElement = null;
            }
            
            // 清除拖放区域高亮
            if (this.lastHighlightedZone) {
                this.lastHighlightedZone.element.classList.remove('over');
                this.lastHighlightedZone = null;
            }
            
            // 移除全局事件监听
            document.removeEventListener('pointermove', this.handlePointerMove.bind(this));
            document.removeEventListener('pointerup', this.handlePointerUp.bind(this));
            document.removeEventListener('pointercancel', this.handlePointerCancel.bind(this));
            
            // 恢复文本选择和页面滚动
            document.body.style.userSelect = '';
            document.body.style.overflow = '';
            
            // 重置状态
            this.dragValue = null;
            this.dragType = null;
        }
    };

    // Initialize the game
    function initGame() {
        // Clear previous content
        answersContainer.innerHTML = '';
        tableBody.innerHTML = '';
        successMessage.style.display = 'none';
        gameState.filledCells = 0;
        gameState.correctCells = 0;
        gameState.correctRows = 0;
        gameState.incorrectCells = 0;
        gameState.isCompleted = false;
        gameState.cardLocations = {};
        gameState.draggedCard = null;
        
        // 根据当前关卡设置总单元格数
        const config = levelConfigs[gameState.currentLevel];
        gameState.totalCells = gameData.length * config.answerTypes.length;
        
        // 更新表格区域类名 - 为第四关添加特殊类名
        updateTableSectionClass();
        
        // Update UI elements
        updateGameInfo();
        
        // Update next button state
        nextBtn.disabled = true;
        
        // 更新Next按钮文本
        updateNextButtonText();
        
        // Create answer cards
        createAnswerCards();
        
        // Create table with appropriate fixed column
        createTable();
        
        // Update counts
        updateCounts();
        
        // Setup event listeners
        setupEventListeners();
        
        // Update level selector
        updateLevelSelector();
        
        // 初始化拖拽管理器
        setTimeout(() => {
            dragManager.cacheDropZones();
        }, 100);
    }

    // 更新表格区域类名，为第四关添加特殊样式
    function updateTableSectionClass() {
        // 移除所有可能存在的关卡类名
        tableSection.classList.remove('level-1', 'level-2', 'level-3', 'level-4');
        
        // 为当前关卡添加类名
        tableSection.classList.add(`level-${gameState.currentLevel}`);
    }

    // Create answer cards for dragging
    function createAnswerCards() {
        const config = levelConfigs[gameState.currentLevel];
        
        // 收集所有需要的答案
        let allAnswers = [];
        
        config.answerTypes.forEach(type => {
            gameData.forEach(item => {
                allAnswers.push({ 
                    type: type, 
                    value: item[type],
                    // 存储对应的其他值以便验证
                    expected: {
                        fraction: item.fraction,
                        decimal: item.decimal,
                        percent: item.percent
                    }
                });
            });
        });
        
        // For round 1: ordered answers (by type)
        // For round 2: shuffled answers
        if (gameState.currentRound === 2) {
            allAnswers = shuffleArray(allAnswers);
        }
        
        // Create answer cards in the container
        allAnswers.forEach(answer => {
            // 创建唯一的ID，确保即使值相同，类型不同也能区分
            const cardId = `card-${answer.type}-${answer.value.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).substr(2, 9)}`;
            
            const card = document.createElement('div');
            card.className = `answer-card ${answer.type} in-bank`;
            card.textContent = answer.value;
            card.setAttribute('data-type', answer.type);
            card.setAttribute('data-value', answer.value);
            // 存储完整数据以便验证
            card.setAttribute('data-fraction', answer.expected.fraction);
            card.setAttribute('data-decimal', answer.expected.decimal);
            card.setAttribute('data-percent', answer.expected.percent);
            card.setAttribute('id', cardId);
            
            // 添加移动端拖拽事件
            card.addEventListener('pointerdown', handlePointerStart);
            
            answersContainer.appendChild(card);
            
            // Track card location
            gameState.cardLocations[cardId] = 'bank';
        });
    }

    // Create the conversion table based on current level
    function createTable() {
        const config = levelConfigs[gameState.currentLevel];
        
        gameData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.setAttribute('data-row-index', index);
            row.setAttribute('data-fraction', item.fraction);
            row.setAttribute('data-decimal', item.decimal);
            row.setAttribute('data-percent', item.percent);
            
            // 创建三列
            const columnTypes = ['fraction', 'decimal', 'percent'];
            columnTypes.forEach(columnType => {
                const cell = document.createElement('td');
                
                if (columnType === config.fixedColumn) {
                    // 固定列：显示已知值
                    cell.className = `fixed-cell ${columnType}`;
                    cell.textContent = item[columnType];
                    cell.setAttribute('data-type', columnType);
                    cell.setAttribute('data-value', item[columnType]);
                } else {
                    // 可拖放区域
                    cell.className = `drop-zone ${columnType}`;
                    cell.setAttribute('data-type', columnType);
                    cell.setAttribute('data-expected', item[columnType]);
                    cell.setAttribute('data-row-index', index);
                    cell.setAttribute('data-filled', 'false');
                    
                    // 对于第四关，所有单元格都是可拖放的
                    if (gameState.currentLevel === 4) {
                        cell.setAttribute('data-expected', ''); // 第四关不需要预期值
                    }
                }
                
                row.appendChild(cell);
            });
            
            tableBody.appendChild(row);
        });
    }

    // Update game information display
    function updateGameInfo() {
        const config = levelConfigs[gameState.currentLevel];
        
        roundNumber.textContent = gameState.currentRound;
        totalCount.textContent = gameState.totalCells;
        
        // Update level description
        levelDescription.textContent = `Level ${gameState.currentLevel}: ${config.description}`;
        
        // Update instructions and hint
        gameInstructions.textContent = config.instructions;
        hintText.textContent = config.hint;
        
        // 更新关卡选择器
        updateLevelSelector();
    }
    
    // 更新Next按钮文本
    function updateNextButtonText() {
        if (gameState.currentLevel === 4 && gameState.currentRound === 2 && gameState.isCompleted) {
            // 第四关第二回合完成时，按钮显示为"Practice Again"
            nextBtn.textContent = 'Practice Again';
        } else {
            // 其他情况下显示"Next Round"
            nextBtn.textContent = 'Next Round';
        }
    }

    // Update level selector buttons
    function updateLevelSelector() {
        document.querySelectorAll('.level-btn').forEach(btn => {
            const level = parseInt(btn.getAttribute('data-level'));
            if (level === gameState.currentLevel) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Update all counts
    function updateCounts() {
        const config = levelConfigs[gameState.currentLevel];
        
        filledCount.textContent = gameState.filledCells;
        
        // 根据关卡类型显示不同的正确计数
        if (gameState.currentLevel === 4) {
            // 第四关：显示正确的行数
            correctCount.textContent = gameState.correctRows;
            incorrectCount.textContent = gameState.totalRows - gameState.correctRows;
            
            // 检查是否完成：所有行都正确
            if (gameState.filledCells === gameState.totalCells && gameState.correctRows === gameState.totalRows) {
                gameState.isCompleted = true;
                successMessage.style.display = 'block';
                nextBtn.disabled = false;
                
                // 更新Next按钮文本
                updateNextButtonText();
            } else {
                successMessage.style.display = 'none';
                nextBtn.disabled = true;
            }
        } else {
            // 前3关：显示正确的单元格数
            correctCount.textContent = gameState.correctCells;
            incorrectCount.textContent = gameState.incorrectCells;
            
            // 检查是否完成：所有单元格都正确
            if (gameState.filledCells === gameState.totalCells && gameState.correctCells === gameState.totalCells) {
                gameState.isCompleted = true;
                successMessage.style.display = 'block';
                nextBtn.disabled = false;
            } else {
                successMessage.style.display = 'none';
                nextBtn.disabled = true;
            }
        }
    }

    // 检查第四关的行是否正确
    function checkRowForLevel4(rowIndex) {
        const row = document.querySelector(`tr[data-row-index="${rowIndex}"]`);
        const cells = row.querySelectorAll('.drop-zone');
        
        // 检查行是否已填满
        let isRowFilled = true;
        cells.forEach(cell => {
            if (cell.getAttribute('data-filled') !== 'true') {
                isRowFilled = false;
            }
        });
        
        if (!isRowFilled) {
            // 行未填满，移除正确样式
            row.classList.remove('row-correct');
            return false;
        }
        
        // 收集行中所有卡片的数据
        const rowData = {
            fractions: [],
            decimals: [],
            percents: []
        };
        
        let isValid = true;
        cells.forEach(cell => {
            const card = cell.querySelector('.answer-card');
            if (card) {
                const fraction = card.getAttribute('data-fraction');
                const decimal = card.getAttribute('data-decimal');
                const percent = card.getAttribute('data-percent');
                
                rowData.fractions.push(fraction);
                rowData.decimals.push(decimal);
                rowData.percents.push(percent);
            } else {
                isValid = false;
            }
        });
        
        if (!isValid) return false;
        
        // 检查所有分数是否相同，所有小数是否相同，所有百分数是否相同
        const allFractionsSame = rowData.fractions.every(val => val === rowData.fractions[0]);
        const allDecimalsSame = rowData.decimals.every(val => val === rowData.decimals[0]);
        const allPercentsSame = rowData.percents.every(val => val === rowData.percents[0]);
        
        const isRowCorrect = allFractionsSame && allDecimalsSame && allPercentsSame;
        
        // 更新行样式
        if (isRowCorrect) {
            row.classList.add('row-correct');
        } else {
            row.classList.remove('row-correct');
        }
        
        return isRowCorrect;
    }

    // 检查所有行（用于第四关）
    function checkAllRowsForLevel4() {
        let correctRows = 0;
        for (let i = 0; i < gameState.totalRows; i++) {
            if (checkRowForLevel4(i)) {
                correctRows++;
            }
        }
        gameState.correctRows = correctRows;
    }

    // Setup event listeners for drag and drop
    function setupEventListeners() {
        // Button events
        resetBtn.addEventListener('click', resetRound);
        nextBtn.addEventListener('click', nextRound);
        
        // Level selector events
        levelSelector.addEventListener('click', handleLevelSelect);
    }

    // Handle level selection
    function handleLevelSelect(e) {
        if (e.target.classList.contains('level-btn')) {
            const level = parseInt(e.target.getAttribute('data-level'));
            
            // 检查是否是当前关卡
            if (level === gameState.currentLevel) return;
            
            // 更新当前关卡
            gameState.currentLevel = level;
            gameState.currentRound = 1; // 重置为第一回合
            
            // 重新初始化游戏
            initGame();
        }
    }

    // Pointer start handler
    function handlePointerStart(e) {
        // 防止多点触摸
        if (e.pointerType === 'touch' && e.isPrimary === false) return;
        
        // 防止右键点击
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // 开始拖拽
        const started = dragManager.startDrag(e.target, e.clientX, e.clientY);
        
        if (started) {
            e.target.setPointerCapture(e.pointerId);
        }
    }

    // Return a card to the answer bank
    function returnToAnswerBank(card) {
        const cardId = card.id;
        
        // If card is already in the bank, do nothing
        if (gameState.cardLocations[cardId] === 'bank') return;
        
        // Remove card from its current cell
        const location = gameState.cardLocations[cardId];
        if (location && location !== 'bank') {
            const cell = document.querySelector(`.drop-zone[data-row-index="${location.row}"][data-type="${location.type}"]`);
            if (cell) {
                // Remove the card from the cell
                cell.innerHTML = '';
                cell.setAttribute('data-filled', 'false');
                cell.classList.remove('correct', 'incorrect');
                
                // Update counts
                gameState.filledCells--;
                
                // 对于第四关，更新行检查
                if (gameState.currentLevel === 4) {
                    checkAllRowsForLevel4();
                } else {
                    // 前3关：检查这个单元格是否正确
                    if (cell.classList.contains('correct')) {
                        gameState.correctCells--;
                    } else if (cell.classList.contains('incorrect')) {
                        gameState.incorrectCells--;
                    }
                }
                
                // Clear any validation classes
                cell.classList.remove('correct', 'incorrect');
            }
        }
        
        // Reset card appearance
        card.classList.remove('in-cell');
        card.classList.add('in-bank');
        
        // Move card back to answer bank
        answersContainer.appendChild(card);
        
        // Update card location tracking
        gameState.cardLocations[cardId] = 'bank';
        
        // Update counts
        updateCounts();
        
        // 重新缓存拖放区域
        dragManager.cacheDropZones();
    }

    // Drop a card to a table cell
    function dropToTableCell(card, cell) {
        const cardId = card.id;
        const cardType = card.getAttribute('data-type');
        const cardValue = card.getAttribute('data-value');
        const cellType = cell.getAttribute('data-type');
        const rowIndex = parseInt(cell.getAttribute('data-row-index'));
        
        // Check if the cell already has a card
        const existingCard = cell.querySelector('.answer-card');
        if (existingCard) {
            // Swap cards: return existing card to bank and place new card
            returnToAnswerBank(existingCard);
        }
        
        // 对于第四关，不限制卡片类型，因为所有单元格都是空的
        // 对于前3关，检查卡片类型是否匹配单元格类型
        if (gameState.currentLevel !== 4 && cardType !== cellType) {
            // Show gentle visual feedback for incorrect type
            cell.classList.add('incorrect');
            setTimeout(() => {
                cell.classList.remove('incorrect');
            }, 500);
            return;
        }
        
        // Get the row data for validation
        const row = cell.closest('tr');
        
        // 对于第四关，不需要预期值
        let expectedValue = null;
        if (gameState.currentLevel !== 4) {
            expectedValue = cell.getAttribute('data-expected');
        }
        
        // Remove card from its current location
        if (gameState.cardLocations[cardId] === 'bank') {
            // Card was in the bank
            card.remove();
        } else {
            // Card was in another cell
            const oldLocation = gameState.cardLocations[cardId];
            if (oldLocation && oldLocation !== 'bank') {
                const oldCell = document.querySelector(`.drop-zone[data-row-index="${oldLocation.row}"][data-type="${oldLocation.type}"]`);
                if (oldCell) {
                    oldCell.innerHTML = '';
                    oldCell.setAttribute('data-filled', 'false');
                    oldCell.classList.remove('correct', 'incorrect');
                    
                    // Update counts
                    gameState.filledCells--;
                    
                    // 对于第四关，更新行检查
                    if (gameState.currentLevel === 4) {
                        // 第四关的行检查会在之后统一进行
                    } else {
                        // 前3关：检查旧单元格是否正确
                        if (oldCell.classList.contains('correct')) {
                            gameState.correctCells--;
                        } else if (oldCell.classList.contains('incorrect')) {
                            gameState.incorrectCells--;
                        }
                    }
                }
            }
        }
        
        // Create a new card for the cell (clone of the original)
        const newCard = card.cloneNode(true);
        newCard.classList.remove('in-bank');
        newCard.classList.add('in-cell');
        
        // 添加移动端拖拽事件
        newCard.addEventListener('pointerdown', handlePointerStart);
        
        // Add card to cell
        cell.innerHTML = '';
        cell.appendChild(newCard);
        cell.setAttribute('data-filled', 'true');
        
        // 验证答案（根据关卡类型）
        let isCorrect = false;
        
        if (gameState.currentLevel === 4) {
            // 第四关：不验证单个单元格，而是验证整行
            // 单元格总是正确的（因为不验证类型）
            cell.classList.remove('correct', 'incorrect');
            isCorrect = true; // 单个单元格总是可以放置
        } else {
            // 前3关：验证单个单元格
            isCorrect = cardValue === expectedValue;
            
            // Apply appropriate styling
            cell.classList.remove('correct', 'incorrect');
            if (isCorrect) {
                cell.classList.add('correct');
                gameState.correctCells++;
            } else {
                cell.classList.add('incorrect');
                gameState.incorrectCells++;
            }
        }
        
        // Update counts
        gameState.filledCells++;
        
        // Update card location tracking
        gameState.cardLocations[cardId] = { row: rowIndex, type: cellType };
        
        // 对于第四关，检查整行
        if (gameState.currentLevel === 4) {
            checkRowForLevel4(rowIndex);
            checkAllRowsForLevel4();
        }
        
        // Update counts and check completion
        updateCounts();
        
        // 重新缓存拖放区域
        dragManager.cacheDropZones();
    }

    // Reset the current round
    function resetRound() {
        // Move all cards back to answer bank
        Object.keys(gameState.cardLocations).forEach(cardId => {
            if (gameState.cardLocations[cardId] !== 'bank') {
                const card = document.getElementById(cardId);
                if (card) {
                    returnToAnswerBank(card);
                }
            }
        });
        
        // Reset counts
        gameState.filledCells = 0;
        gameState.correctCells = 0;
        gameState.correctRows = 0;
        gameState.incorrectCells = 0;
        
        // Clear all cells
        document.querySelectorAll('.drop-zone').forEach(zone => {
            zone.innerHTML = '';
            zone.setAttribute('data-filled', 'false');
            zone.classList.remove('correct', 'incorrect', 'over');
        });
        
        // 清除第四关的行正确样式
        document.querySelectorAll('tr').forEach(row => {
            row.classList.remove('row-correct');
        });
        
        // Reset all cards in bank
        document.querySelectorAll('.answer-card').forEach(card => {
            card.classList.remove('in-cell');
            card.classList.add('in-bank');
        });
        
        // Reset UI
        successMessage.style.display = 'none';
        nextBtn.disabled = true;
        
        // Update counts
        updateCounts();
        
        // 重新缓存拖放区域
        dragManager.cacheDropZones();
    }

    // Move to next round or level
    function nextRound() {
        if (!gameState.isCompleted) return;
        
        // 特殊处理第四关
        if (gameState.currentLevel === 4 && gameState.currentRound === 2) {
            // 第四关第二回合完成：重新开始第四关的练习
            gameState.currentRound = 1;
            resetRound();
            initGame();
            return;
        }
        
        if (gameState.currentRound < gameState.totalRounds) {
            // Move to next round in the same level
            gameState.currentRound++;
            resetRound();
            initGame();
        } else {
            // Current level completed
            if (gameState.currentLevel < 4) {
                // Move to next level
                const nextLevel = gameState.currentLevel + 1;
                const levelName = levelConfigs[nextLevel].description;
                
                alert(`Level ${gameState.currentLevel} completed! You have successfully matched all values. Moving to Level ${nextLevel}: ${levelName}.`);
                
                gameState.currentLevel = nextLevel;
                gameState.currentRound = 1;
                resetRound();
                initGame();
            } else {
                // 第四关第一回合完成，进入第二回合
                gameState.currentRound = 2;
                resetRound();
                initGame();
            }
        }
    }

    // Utility function to shuffle array
    function shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    // Initialize the game when page loads
    initGame();
});