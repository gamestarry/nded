// 乘法游戏核心逻辑 - 移动端优化版
document.addEventListener('DOMContentLoaded', function() {
    // 从页面获取乘数（从data-multiplier属性）
    const gameContainer = document.querySelector('.multiplication-game');
    const multiplier = parseInt(gameContainer.dataset.multiplier) || 2;
    
    // 检测是否为9的乘法游戏
    const isMultiplicationBy9 = multiplier === 9;
    
    // 动态生成游戏状态
    let gameState = {
        correctAnswers: 0,
        totalEquations: multiplier, // 动态设置算式数量
        roundCompleted: false,
        completionCount: 0,
        maxCompletions: 2,
        // 动态生成答案和算式
        answers: [],
        equations: [],
        // 跟踪当前回合中已使用的答案
        usedAnswers: new Set(),
        // 跟踪当前回合中已完成的算式
        completedEquations: new Set()
    };
    
    // 动态生成答案和算式
    for (let i = 1; i <= multiplier; i++) {
        gameState.answers.push(i * multiplier);
        gameState.equations.push({
            multiplier: i,
            result: i * multiplier
        });
    }
    
    // DOM元素
    const answersContainer = document.getElementById('answers-container');
    const equationsContainer = document.getElementById('equations-container');
    const restartBtn = document.getElementById('restart-btn');
    const nextBtn = document.getElementById('next-btn');
    const completionCounter = document.getElementById('completion-counter');
    
    // ========== 移动端拖拽优化部分 ==========
    
    // 拖拽状态管理器
    const dragManager = {
        // 状态
        isDragging: false,
        currentElement: null,
        ghostElement: null,
        dragValue: null,
        startX: 0,
        startY: 0,
        offsetX: 0,
        offsetY: 0,
        currentX: 0,
        currentY: 0,
        
        // 预缓存的拖放区域数据
        dropZones: [],
        lastHighlightedZone: null,
        
        // 动画帧ID（用于requestAnimationFrame节流）
        animationFrameId: null,
        pendingUpdate: false,
        
        // 性能监控
        frameCount: 0,
        lastFrameTime: 0,
        
        // 初始化拖拽管理器
        init: function() {
            this.cacheDropZones();
            
            // 监听窗口大小变化，重新缓存拖放区域
            window.addEventListener('resize', () => {
                this.cacheDropZones();
            });
            
            // 监听页面滚动，重新缓存拖放区域
            window.addEventListener('scroll', () => {
                this.cacheDropZones();
            }, { passive: true });
            
            // 开始性能监控（仅在开发模式）
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                this.startPerformanceMonitoring();
            }
        },
        
        // 预缓存所有可拖放区域的位置信息
        cacheDropZones: function() {
            const dropZoneElements = document.querySelectorAll('.equation-result:not(.filled)');
            this.dropZones = Array.from(dropZoneElements).map(zone => {
                const rect = zone.getBoundingClientRect();
                const equation = zone.closest('.equation');
                const multiplierValue = parseInt(equation.dataset.multiplier);
                
                // 检查算式是否已完成
                const isCompleted = gameState.completedEquations.has(multiplierValue);
                
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
                    multiplier: multiplierValue,
                    correctValue: parseInt(zone.dataset.correct),
                    isCompleted: isCompleted
                };
            });
            
            console.log(`缓存了 ${this.dropZones.length} 个拖放区域`);
        },
        
        // 开始拖拽
        startDrag: function(element, clientX, clientY) {
            const value = parseInt(element.dataset.value);
            
            // 检查答案是否已使用
            if (gameState.usedAnswers.has(value)) {
                return false;
            }
            
            this.isDragging = true;
            this.currentElement = element;
            this.dragValue = value;
            
            // 获取元素位置
            const rect = element.getBoundingClientRect();
            this.startX = clientX;
            this.startY = clientY;
            this.offsetX = clientX - rect.left;
            this.offsetY = clientY - rect.top;
            this.currentX = rect.left;
            this.currentY = rect.top;
            
            // 创建拖拽幽灵（高性能克隆）
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
        
        // 创建高性能拖拽幽灵（修复闪现问题）
        createDragGhost: function(sourceElement, sourceRect) {
            // 创建幽灵元素
            this.ghostElement = sourceElement.cloneNode(true);
            this.ghostElement.classList.add('drag-ghost');
            this.ghostElement.classList.remove('dragging');
            
            // 应用GPU加速样式 - 关键：在添加到DOM前完成所有样式设置
            const style = window.getComputedStyle(sourceElement);
            
            // 1. 先设置基础样式
            this.ghostElement.style.width = `${sourceRect.width}px`;
            this.ghostElement.style.height = `${sourceRect.height}px`;
            
            // 2. 确保position: fixed（覆盖可能存在的其他定位）
            this.ghostElement.style.position = 'fixed';
            this.ghostElement.style.left = '0';
            this.ghostElement.style.top = '0';
            this.ghostElement.style.margin = '0';
            
            // 3. 复制关键样式
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
            this.ghostElement.style.zIndex = '9999';
            
            // 4. 设置初始位置到屏幕外（避免闪现）
            this.ghostElement.style.transform = `translate3d(-1000px, -1000px, 0)`;
            
            // 5. 添加到文档（此时元素在屏幕外，不会闪现）
            document.body.appendChild(this.ghostElement);
            
            // 6. 强制同步布局，确保样式应用
            this.ghostElement.offsetHeight;
            
            // 7. 立即移动到正确位置（同一帧内）
            const transformX = this.startX - this.offsetX;
            const transformY = this.startY - this.offsetY;
            this.ghostElement.style.transform = 
                `translate3d(${transformX}px, ${transformY}px, 0) scale(1.05)`;
            
            // 8. 强制重绘，确保平滑过渡
            this.ghostElement.getBoundingClientRect();
        },
        
        // 指针移动处理（使用requestAnimationFrame节流）
        handlePointerMove: function(e) {
            if (!this.isDragging) return;
            
            e.preventDefault();
            
            // 更新当前位置
            this.currentX = e.clientX - this.offsetX;
            this.currentY = e.clientY - this.offsetY;
            
            // 使用requestAnimationFrame节流更新
            if (!this.pendingUpdate) {
                this.pendingUpdate = true;
                this.animationFrameId = requestAnimationFrame(() => {
                    this.updateDragPosition(e.clientX, e.clientY);
                    this.pendingUpdate = false;
                });
            }
        },
        
        // 更新拖拽位置（GPU加速）
        updateDragPosition: function(clientX, clientY) {
            if (!this.isDragging || !this.ghostElement) return;
            
            // 计算transform位置
            const transformX = clientX - this.offsetX;
            const transformY = clientY - this.offsetY;
            
            // 使用transform3d进行GPU加速
            // 注意：直接设置transform，不添加过渡效果
            this.ghostElement.style.transform = 
                `translate3d(${transformX}px, ${transformY}px, 0) scale(1.05)`;
            
            // 碰撞检测（优化：只在位置变化较大时检测）
            this.checkDropZoneCollision(clientX, clientY);
            
            // 性能监控
            this.monitorFrameRate();
        },
        
        // 碰撞检测（使用预缓存的数据）
        checkDropZoneCollision: function(x, y) {
            let currentZone = null;
            let minDistance = Infinity;
            
            // 遍历所有缓存的拖放区域
            for (const zone of this.dropZones) {
                // 跳过已完成的算式
                if (zone.isCompleted) continue;
                
                // 快速矩形碰撞检测
                if (x >= zone.rect.x && x <= zone.rect.right &&
                    y >= zone.rect.y && y <= zone.rect.bottom) {
                    
                    // 计算到中心点的距离（用于圆形元素的精确检测）
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
                this.lastHighlightedZone.element.classList.remove('drag-over-highlight');
                this.lastHighlightedZone.element.classList.remove('drag-over');
            }
            
            // 设置新的高亮
            if (zone && zone !== this.lastHighlightedZone) {
                zone.element.classList.add('drag-over-highlight');
                this.lastHighlightedZone = zone;
            } else if (!zone && this.lastHighlightedZone) {
                this.lastHighlightedZone.element.classList.remove('drag-over-highlight');
                this.lastHighlightedZone = null;
            }
        },
        
        // 结束拖拽
        handlePointerUp: function(e) {
            if (!this.isDragging) return;
            
            e.preventDefault();
            
            // 获取放置位置
            const dropZone = this.lastHighlightedZone;
            
            // 检查是否可以放置
            if (dropZone && !dropZone.isCompleted) {
                // 检查答案是否正确
                if (this.dragValue === dropZone.correctValue) {
                    this.handleSuccessfulDrop(this.currentElement, dropZone.element);
                } else {
                    // 错误的答案反馈
                    this.showErrorFeedback();
                }
            }
            
            // 清理拖拽状态
            this.endDrag();
        },
        
        // 取消拖拽
        handlePointerCancel: function() {
            if (!this.isDragging) return;
            this.endDrag();
        },
        
        // 成功放置处理
        handleSuccessfulDrop: function(sourceElement, dropZone) {
            // 标记答案已使用
            gameState.usedAnswers.add(this.dragValue);
            
            // 标记算式已完成
            const equationEl = dropZone.closest('.equation');
            const multiplierValue = parseInt(equationEl.dataset.multiplier);
            gameState.completedEquations.add(multiplierValue);
            
            // 更新拖放区域
            dropZone.textContent = this.dragValue;
            dropZone.classList.add('filled');
            dropZone.classList.remove('drag-over-highlight');
            
            // 确保应用正确的样式
            // 清除可能存在的其他样式
            dropZone.style.background = '';
            dropZone.style.color = '';
            dropZone.style.boxShadow = '';
            
            // 更新答案元素
            sourceElement.classList.add('used');
            sourceElement.classList.remove('dragging');
            
            // 更新正确答案计数
            gameState.correctAnswers++;
            
            // 检查是否所有算式都已完成
            if (gameState.correctAnswers === gameState.totalEquations) {
                gameState.roundCompleted = true;
                gameState.completionCount++;
                updateCompletionCounter();
                updateNextButton();
            }
            
            // 重新缓存拖放区域（因为有些区域已经完成）
            this.cacheDropZones();
            
            // 成功动画
            this.showSuccessFeedback(dropZone);
        },
        
        // 显示成功反馈
        showSuccessFeedback: function(element) {
            element.style.animation = 'none';
            element.offsetHeight; // 触发重绘
            element.style.animation = 'success-pop 0.3s ease';
        },
        
        // 显示错误反馈
        showErrorFeedback: function() {
            if (this.ghostElement) {
                this.ghostElement.style.animation = 'none';
                this.ghostElement.offsetHeight;
                
                // 红色抖动动画
                this.ghostElement.style.animation = 'shake 0.5s ease';
                this.ghostElement.style.boxShadow = 
                    '0 0 0 3px rgba(239, 68, 68, 0.3), ' + 
                    this.ghostElement.style.boxShadow;
                
                // 1秒后恢复
                setTimeout(() => {
                    if (this.ghostElement) {
                        this.ghostElement.style.animation = '';
                        this.ghostElement.style.boxShadow = 
                            this.ghostElement.style.boxShadow.replace(
                                /0 0 0 3px rgba\(239, 68, 68, 0\.3\),\s*/,
                                ''
                            );
                    }
                }, 1000);
            }
        },
        
        // 结束拖拽（清理）
        endDrag: function() {
            if (!this.isDragging) return;
            
            this.isDragging = false;
            
            // 取消动画帧
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            
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
                this.lastHighlightedZone.element.classList.remove('drag-over-highlight');
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
            this.pendingUpdate = false;
        },
        
        // 性能监控
        startPerformanceMonitoring: function() {
            this.lastFrameTime = performance.now();
            const monitor = () => {
                this.frameCount++;
                const now = performance.now();
                if (now - this.lastFrameTime >= 1000) {
                    const fps = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime));
                    if (fps < 50 && this.isDragging) {
                        console.warn(`拖拽帧率较低: ${fps} FPS`);
                    }
                    this.frameCount = 0;
                    this.lastFrameTime = now;
                }
                requestAnimationFrame(monitor);
            };
            requestAnimationFrame(monitor);
        },
        
        monitorFrameRate: function() {
            this.frameCount++;
            const now = performance.now();
            if (now - this.lastFrameTime >= 1000) {
                const fps = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime));
                console.log(`拖拽帧率: ${fps} FPS`);
                this.frameCount = 0;
                this.lastFrameTime = now;
            }
        }
    };
    
    // 初始化拖拽管理器
    dragManager.init();
    
    // 显示粘土风格完成弹窗
    function showCompletionMessage() {
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'completion-overlay';
        
        // 创建弹窗
        const modal = document.createElement('div');
        modal.className = 'completion-modal';
        
        // 弹窗内容 - 使用粘土风格
        modal.innerHTML = `
            <h2 class="completion-title">🎉 Congratulations！ 🏆</h2>
            <div class="completion-message">
                You've mastered<br><strong>Multiplication Tables 2–9</strong>
            </div>
            
            <div class="completion-buttons">
                <button id="return-home-btn">
                    🏠 Return to Home
                </button>
                <button id="practice-again-btn">
                    🔄 Practice Again
                </button>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(overlay);
        overlay.appendChild(modal);
        
        // 激活遮罩层和弹窗
        setTimeout(() => {
            overlay.classList.add('active');
        }, 10);
        
        // 返回首页按钮事件
        document.getElementById('return-home-btn').addEventListener('click', function() {
            window.location.href = "../index.html";
        });
        
        // 再次练习按钮事件
        document.getElementById('practice-again-btn').addEventListener('click', function() {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                initGame(); // 重新开始游戏
            }, 300);
        });
        
        // 点击遮罩层也可以关闭
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                window.location.href = "../index.html";
            }
        });
    }
    
    // 初始化游戏
    function initGame() {
        // 重置回合状态（但保留完成次数）
        gameState.correctAnswers = 0;
        gameState.roundCompleted = false;
        gameState.usedAnswers.clear();
        gameState.completedEquations.clear();
        
        // 更新完成计数器显示
        updateCompletionCounter();
        
        // 清空容器
        answersContainer.innerHTML = '';
        equationsContainer.innerHTML = '';
        
        // 如果是9的乘法游戏，初始化时就设置按钮文字
        if (isMultiplicationBy9) {
            nextBtn.textContent = 'Table Complete';
        }
        
        // 后续回合随机化答案（第一轮后）
        let answers = [...gameState.answers];
        if (gameState.completionCount > 0) {
            // 使用Fisher-Yates算法洗牌数组
            for (let i = answers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [answers[i], answers[j]] = [answers[j], answers[i]];
            }
        }
        
        // 创建答案元素
        answers.forEach(answer => {
            const answerEl = document.createElement('div');
            answerEl.className = 'answer';
            answerEl.textContent = answer;
            answerEl.dataset.value = answer;
            
            // 添加Pointer Events（统一处理鼠标和触摸）
            answerEl.addEventListener('pointerdown', handlePointerStart);
            
            // 为了兼容性，保留原有的dragstart事件（PC端）
            answerEl.draggable = true;
            answerEl.addEventListener('dragstart', handleDragStart);
            answerEl.addEventListener('dragend', handleDragEnd);
            
            answersContainer.appendChild(answerEl);
        });
        
        // 创建算式元素
        // 对于乘数3，我们创建3个算式和1个空白框（保持2×2布局）
        // 对于其他乘数，只创建对应数量的算式
        const totalBoxes = multiplier === 3 ? 4 : multiplier;
        
        for (let i = 0; i < totalBoxes; i++) {
            if (i < gameState.equations.length) {
                // 创建算式框
                const equation = gameState.equations[i];
                const equationEl = document.createElement('div');
                equationEl.className = 'equation';
                equationEl.dataset.multiplier = equation.multiplier;
                equationEl.dataset.result = equation.result;
                
                // 创建数字框
                const numberBox = document.createElement('div');
                numberBox.className = 'equation-number';
                numberBox.textContent = equation.multiplier;
                
                // 创建算式文本
                const equationText = document.createElement('span');
                equationText.textContent = `× ${multiplier} =`;
                
                // 创建结果框（拖放区域）
                const resultBox = document.createElement('div');
                resultBox.className = 'equation-result';
                resultBox.dataset.correct = equation.result;
                
                // 为了兼容性，保留原有的拖放事件（PC端）
                resultBox.addEventListener('dragover', handleDragOver);
                resultBox.addEventListener('dragleave', handleDragLeave);
                resultBox.addEventListener('drop', handleDrop);
                
                // 添加元素
                equationEl.appendChild(numberBox);
                equationEl.appendChild(equationText);
                equationEl.appendChild(resultBox);
                
                equationsContainer.appendChild(equationEl);
            } else if (multiplier === 3 && i === 3) {
                // 只为乘数3创建空白框
                const emptyBoxEl = document.createElement('div');
                emptyBoxEl.className = 'empty-box';
                equationsContainer.appendChild(emptyBoxEl);
            }
        }
        
        // 更新下一关按钮状态
        updateNextButton();
        
        // 创建回到首页小按钮
        createHomeButton();
        
        // 初始化拖拽管理器的缓存
        setTimeout(() => {
            dragManager.cacheDropZones();
        }, 100);
    }
    
    // ========== 事件处理函数 ==========
    
    // Pointer Events 处理
    function handlePointerStart(e) {
        // 防止多点触摸
        if (e.pointerType === 'touch' && e.isPrimary === false) return;
        
        // 防止右键点击
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        // 修复拖拽闪现问题：始终阻止默认行为
        e.preventDefault();
        e.stopPropagation();
        
        // 开始拖拽
        const started = dragManager.startDrag(e.target, e.clientX, e.clientY);
        
        if (started) {
            // 设置捕获指针，确保移动事件被正确捕获
            e.target.setPointerCapture(e.pointerId);
        }
    }
    
    // 原有的PC端拖拽事件（保持兼容性）
    function handleDragStart(e) {
        // 如果答案已使用，不允许拖拽
        if (gameState.usedAnswers.has(parseInt(e.target.dataset.value))) {
            e.preventDefault();
            return;
        }
        
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', e.target.dataset.value);
        
        // 修复拖拽闪现问题：始终阻止默认拖拽行为
        e.preventDefault();
    }
    
    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
    }
    
    function handleDragOver(e) {
        e.preventDefault();
        
        // 只有算式未完成时才允许拖放
        const equationEl = e.target.closest('.equation');
        if (equationEl && !equationEl.classList.contains('empty-box')) {
            const multiplierValue = parseInt(equationEl.dataset.multiplier);
            if (!gameState.completedEquations.has(multiplierValue)) {
                e.target.classList.add('drag-over');
            }
        }
    }
    
    function handleDragLeave(e) {
        e.target.classList.remove('drag-over');
    }
    
    function handleDrop(e) {
        e.preventDefault();
        e.target.classList.remove('drag-over');
        
        // 获取拖拽的值
        const draggedValue = parseInt(e.dataTransfer.getData('text/plain'));
        const dropZone = e.target;
        const correctValue = parseInt(dropZone.dataset.correct);
        const equationEl = dropZone.closest('.equation');
        const multiplierValue = parseInt(equationEl.dataset.multiplier);
        
        // 检查算式是否已完成
        if (gameState.completedEquations.has(multiplierValue)) {
            return;
        }
        
        // 检查答案是否已使用
        if (gameState.usedAnswers.has(draggedValue)) {
            return;
        }
        
        // 检查答案是否正确
        if (draggedValue === correctValue) {
            // 标记答案已使用
            gameState.usedAnswers.add(draggedValue);
            
            // 标记算式已完成
            gameState.completedEquations.add(multiplierValue);
            
            // 更新拖放区域
            dropZone.textContent = draggedValue;
            dropZone.classList.add('filled');
            
            // 确保应用正确的样式
            dropZone.style.background = '';
            dropZone.style.color = '';
            dropZone.style.boxShadow = '';
            
            // 更新答案元素
            const answerEl = document.querySelector(`.answer[data-value="${draggedValue}"]`);
            if (answerEl) {
                answerEl.classList.add('used');
            }
            
            // 更新正确答案计数
            gameState.correctAnswers++;
            
            // 检查是否所有算式都已完成
            if (gameState.correctAnswers === gameState.totalEquations) {
                gameState.roundCompleted = true;
                gameState.completionCount++;
                updateCompletionCounter();
                updateNextButton();
            }
        }
    }
    
    // 创建回到首页小按钮的函数
    function createHomeButton() {
        // 检查是否已经有标题行
        let titleRow = document.querySelector('.title-row');
        
        if (!titleRow) {
            // 获取原始标题
            const originalTitle = document.querySelector('.multiplication-game h1');
            
            if (originalTitle) {
                // 创建标题行容器
                titleRow = document.createElement('div');
                titleRow.className = 'title-row';
                
                // 创建小首页按钮
                const homeBtn = document.createElement('a');
                homeBtn.className = 'home-btn-small';
                homeBtn.href = '../index.html';  // 链接到首页
                homeBtn.innerHTML = '🏠';  // 使用房子图标
                homeBtn.title = 'Back to Home';  // 鼠标悬停提示
                
                // 创建新的标题容器
                const titleContainer = document.createElement('div');
                titleContainer.className = 'title-with-button';
                
                // 将按钮和标题放入标题容器
                titleContainer.appendChild(homeBtn);
                titleContainer.appendChild(originalTitle);
                
                // 将标题容器放入标题行
                titleRow.appendChild(titleContainer);
                
                // 将标题行插入游戏容器（替换原来的标题位置）
                const gameContainer = document.querySelector('.multiplication-game');
                const completionCounter = document.getElementById('completion-counter');
                
                if (gameContainer && completionCounter) {
                    // 在完成计数器前插入标题行
                    gameContainer.insertBefore(titleRow, completionCounter);
                }
            }
        }
    }
    
    // 更新完成计数器显示
    function updateCompletionCounter() {
        completionCounter.textContent = 
            `Complete 2 times to unlock next level (${gameState.completionCount}/2)`;
    }
    
    // 更新下一关按钮状态
    function updateNextButton() {
        // 完成2次练习后启用按钮
        if (gameState.completionCount >= gameState.maxCompletions) {
            // 如果是9的乘法游戏，启用并显示Table Complete
            if (isMultiplicationBy9) {
                nextBtn.textContent = 'Table Complete';
                nextBtn.classList.add('enabled');
                nextBtn.disabled = false;
            } else if (multiplier < 9) {
                // 乘数小于9，启用并显示Next Level
                nextBtn.textContent = 'Next Level';
                nextBtn.classList.add('enabled');
                nextBtn.disabled = false;
            }
        } else {
            nextBtn.classList.remove('enabled');
            nextBtn.disabled = true;
        }
    }
    
    // 按钮事件处理
    restartBtn.addEventListener('click', function() {
        initGame();
    });
    
    // Next Level按钮点击事件处理
    nextBtn.addEventListener('click', function() {
        // 只有当按钮启用时才执行
        if (nextBtn.disabled) return;
        
        // 如果是9的乘法游戏，显示完成弹窗
        if (isMultiplicationBy9) {
            showCompletionMessage();
        } else if (multiplier < 9) {
            // 跳转到下一个乘数的页面
            const nextMultiplier = multiplier + 1;
            const nextPageUrl = `multiplication-by-${nextMultiplier}-game.html`;
            window.location.href = nextPageUrl;
        }
    });
    
    // 添加抖动动画关键帧（用于错误反馈）
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes shake {
            0%, 100% { transform: translate3d(0, 0, 0); }
            10%, 30%, 50%, 70%, 90% { transform: translate3d(-2px, 0, 0); }
            20%, 40%, 60%, 80% { transform: translate3d(2px, 0, 0); }
        }
    `;
    document.head.appendChild(styleSheet);
    
    // 页面加载时初始化游戏
    initGame();
});