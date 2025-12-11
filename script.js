class Utils {
    static getIEEE754(x) {
        const float = new Float32Array(1);
        float[0] = x;
        return float[0];
    }

    static combinations(n, k) {
        if (k > n) return 0;
        if (k === 0 || k === n) return 1;

        k = Math.min(k, n - k);
        let result = 1;
        for (let i = 1; i <= k; i++) {
            result = result * (n - k + i) / i;
        }
        return Math.round(result);
    }

    static truncateDecimals(number, digits) {
        const multiplier = Math.pow(10, digits);
        const adjustedNum = number * multiplier;
        const truncatedNum = Math[adjustedNum < 0 ? 'ceil' : 'floor'](adjustedNum);
        return truncatedNum / multiplier;
    }

    static countDecimals(value) {
        if (Math.floor(value) === value) return 0;
        return value.toString().split(".")[1].length || 0;
    }
}

const Config = {
    DEFAULT_VALUES: {
        MIN_WEAR: '0.000000',
        MAX_WEAR: '0.800000',
        SPECIFICITY: '0.00000001'
    },
    GRADE_ORDER: ['consumer', 'industrial', 'milspec', 'restricted', 'classified', 'covert', 'ancient'],
    GRADE_NAMES: {
        'consumer': '消费级',
        'industrial': '工业级',
        'milspec': '军规级',
        'restricted': '受限级',
        'classified': '保密级',
        'covert': '隐秘级',
        'ancient': '金色传说！'
    },
    GRADE_COLORS: {
        'consumer': '#E3F2FD',
        'industrial': '#90CAF9',
        'milspec': '#2196F3',
        'restricted': '#9C27B0',
        'classified': '#e423b7ff',
        'covert': '#F44336',
        'ancient': '#FFD700'
    },
    WEAR_GRADE_RANGES: {
        factory_new: { min: 0, max: 0.070000, target: 0.070000 },
        minimal_wear: { min: 0.070000, max: 0.150000, target: 0.150000 },
        field_tested: { min: 0.150000, max: 0.380000, target: 0.380000 },
        well_worn: { min: 0.380000, max: 0.450000, target: 0.450000 },
        battle_scarred: { min: 0.450000, max: 1, target: 1 }
    },
    BATCH_SIZE: 1000
};

class MaterialFinder {
    static findByName(name) {
        if (!name) return null;
        for (const [id, material] of Object.entries(materialDatabase)) {
            if (material.name === name.trim()) {
                return material;
            }
        }
        return null;
    }

    static findFromText(text) {
        if (!text || typeof text !== 'string' || text.trim() === '') {
            return null;
        }

        const cleanedText = text
            .replace(/StatTrak™/gi, 'StatTrak ')
            .replace(/★/g, '')
            .replace(/™/g, '')
            .trim();

        for (const [id, material] of Object.entries(materialDatabase)) {
            const materialName = material.name;

            if (cleanedText.includes(materialName)) {
                return material;
            }

            if (materialName.includes('|')) {
                const [weapon, skin] = materialName.split('|').map(s => s.trim());
                const weaponNoSpaces = weapon.replace(/\s+/g, '');
                const cleanedNoSpaces = cleanedText.replace(/\s+/g, '');

                if (cleanedNoSpaces.includes(weaponNoSpaces) && cleanedText.includes(skin)) {
                    return material;
                }

                const combinedNoSpaces = `${weaponNoSpaces}|${skin}`;
                if (cleanedNoSpaces.includes(combinedNoSpaces)) {
                    return material;
                }
            }
        }

        return null;
    }

    static getGradeChineseName(grade) {
        return Config.GRADE_NAMES[grade] || grade;
    }
}

class MaterialValidator {
    static validateForSynthesis(material, currentGrade, materialCount, context = 'special') {
        if (!material) {
            return { valid: false, message: '材料不存在' };
        }

        if (materialCount === 5 && material.grade !== 'covert') {
            return { valid: false, message: '5个材料合成只能选择隐秘级材料' };
        }

        if (materialCount === 10) {
            if (material.grade === 'covert') {
                return { valid: false, message: '10个材料合成不能选择隐秘级材料' };
            }
            if (material.grade === 'ancient') {
                return { valid: false, message: '金色传说！不能作为合成材料' };
            }

            const allowedGrades = ['consumer', 'industrial', 'milspec', 'restricted', 'classified'];
            if (!allowedGrades.includes(material.grade)) {
                return { valid: false, message: '10个材料合成时只能选择消费级、工业级、军规级、受限级或保密级材料' };
            }
        }

        if (currentGrade && material.grade !== currentGrade) {
            return {
                valid: false,
                message: `只能选择${Config.GRADE_NAMES[currentGrade]}材料，当前是${Config.GRADE_NAMES[material.grade]}`
            };
        }

        if (context === 'selection') {
            const canBeMaterial = this._canMaterialBeUsedForSynthesis(material, materialCount);
            if (!canBeMaterial.valid) {
                return canBeMaterial;
            }
        }

        return { valid: true };
    }

    static _canMaterialBeUsedForSynthesis(material, materialCount) {
        if ((!material.crates || material.crates.length === 0) &&
            (!material.collections || material.collections.length === 0)) {
            return {
                valid: false,
                message: `${material.name} 没有来源信息，不能作为合成材料`
            };
        }

        const targetGrade = this._getTargetGradeForMaterial(material.grade, materialCount);
        if (!targetGrade) {
            return {
                valid: false,
                message: `${Config.GRADE_NAMES[material.grade]} 没有上级产物等级`
            };
        }

        let hasValidSource = false;
        let validSources = [];

        if (material.crates) {
            for (const crateName of material.crates) {
                const crate = crateDatabase[crateName];
                if (crate && crate[targetGrade] && Array.isArray(crate[targetGrade]) && crate[targetGrade].length > 0) {
                    hasValidSource = true;
                    validSources.push({
                        type: 'crate',
                        name: crateName,
                        products: crate[targetGrade]
                    });
                }
            }
        }

        if (material.collections) {
            for (const collectionName of material.collections) {
                const collection = crateDatabase[collectionName];
                if (collection && collection[targetGrade] && Array.isArray(collection[targetGrade]) && collection[targetGrade].length > 0) {
                    hasValidSource = true;
                    validSources.push({
                        type: 'collection',
                        name: collectionName,
                        products: collection[targetGrade]
                    });
                }
            }
        }

        if (!hasValidSource) {
            let errorMsg = `${material.name} (${Config.GRADE_NAMES[material.grade]}) 所属来源中没有${Config.GRADE_NAMES[targetGrade]}级产物`;
            const materialSources = [];
            if (material.crates) materialSources.push(...material.crates.map(c => `${c}(武器箱)`));
            if (material.collections) materialSources.push(...material.collections.map(c => `${c}(收藏品)`));
            if (materialSources.length > 0) {
                errorMsg += `。材料来源于：${materialSources.join('、')}`;
            }
            return {
                valid: false,
                message: errorMsg
            };
        }

        const sourceNames = validSources.map(s => `${s.name}(${s.type === 'crate' ? '武器箱' : '收藏品'})`);
        return {
            valid: true,
            message: `材料有效，可能来源于：${sourceNames.join('、')}`
        };
    }

    static _getTargetGradeForMaterial(materialGrade, materialCount) {
        if (materialCount === 5) {
            if (materialGrade === 'covert') {
                return 'ancient';
            }
            return null;
        }

        if (materialCount === 10) {
            const gradeOrder = ['consumer', 'industrial', 'milspec', 'restricted', 'classified'];
            const currentIndex = gradeOrder.indexOf(materialGrade);
            if (currentIndex < gradeOrder.length - 1) {
                return gradeOrder[currentIndex + 1];
            }
            if (materialGrade === 'classified') {
                return 'covert';
            }
        }
        return null;
    }
}

class CleanupManager {
    static clearAllInputs(inputIds) {
        inputIds.forEach(id => {
            const element = document.getElementById(id);
            if (element && (element.type === 'text' || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
                element.value = '';
            }
        });
    }

    static resetAllSelects(selectIds) {
        selectIds.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.value = select.options[0].value;
            }
        });
    }

    static clearRangeDisplays(rangeIds) {
        rangeIds.forEach(id => {
            const display = document.getElementById(id);
            if (display) {
                display.textContent = '0.000000-0.800000';
                display.style.color = '';
            }
        });
    }

    static resetAllDropdowns() {
        const dropdowns = document.querySelectorAll('.material-dropdown');
        dropdowns.forEach(dropdown => {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
        });
    }
}

class InputValidator {
    static number(input) {
        const cursorPosition = input.selectionStart;
        let newValue = input.value.replace(/[^0-9.]/g, '');
        const parts = newValue.split('.');
        if (parts.length > 2) {
            newValue = parts[0] + '.' + parts.slice(1).join('');
        }
        input.value = newValue;
        input.setSelectionRange(cursorPosition, cursorPosition);
    }
}

class MessageManager {
    static show(message, type = 'info') {
        const toast = document.getElementById('messageToast');
        toast.textContent = message;
        toast.className = 'message-toast';
        toast.classList.add(type);
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    static setLoading(loading) {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            if (!btn.classList.contains('tabButton')) {
                if (btn.id === 'stopButton') {
                    btn.disabled = !loading;
                } else {
                    btn.disabled = loading;
                }
            }
        });

        const stopButton = document.getElementById('stopButton');
        if (stopButton) {
            stopButton.disabled = !loading;
            stopButton.textContent = loading ? '终止计算' : '终止计算';
            stopButton.classList.toggle('danger', loading);
            stopButton.classList.toggle('secondary', !loading);
        }

        document.body.classList.toggle('loading', loading);
    }
}

class TabManager {
    static open(tabName, event) {
        const tabcontents = document.getElementsByClassName("tabcontent");
        const tabbuttons = document.getElementsByClassName("tabButton");

        for (let i = 0; i < tabcontents.length; i++) {
            tabcontents[i].style.display = "none";
            tabcontents[i].classList.remove('active');
            tabbuttons[i].classList.remove('active');
        }

        const targetTab = document.getElementById(tabName);
        targetTab.style.display = "block";
        targetTab.classList.add('active');

        if (event && event.currentTarget) {
            event.currentTarget.classList.add('active');
        } else {
            for (let i = 0; i < tabbuttons.length; i++) {
                if (tabbuttons[i].onclick && tabbuttons[i].onclick.toString().includes(tabName)) {
                    tabbuttons[i].classList.add('active');
                    break;
                }
            }
        }
    }

    static getActive() {
        const tabs = ['floatCombosDiv', 'wearCalculationDiv', 'autoCalculationDiv', 'ieee754Div', 'aboutAuthorDiv'];
        for (const tabId of tabs) {
            const tab = document.getElementById(tabId);
            if (tab && (tab.style.display === 'block' || tab.classList.contains('active'))) {
                return tabId;
            }
        }
        return 'floatCombosDiv';
    }
}

class MaterialManager {
    static data = {};
    static count = 5;
    static typeCount = 1;
    static currentGrade = null;

    static init() {
        const countSelect = document.getElementById('materialCountSelect');
    if (countSelect) {
        this.count = parseInt(countSelect.value) || 5;
    }
    
    const typeSelect = document.getElementById('materialTypeCountSelect');
    if (typeSelect) {
        this.typeCount = parseInt(typeSelect.value) || 1;
    }
        for (let i = 1; i <= 10; i++) {
            if (!this.data[i]) {
                this.data[i] = {
                    input: '',
                    output: '',
                    cumulative: '',
                    minWear: Config.DEFAULT_VALUES.MIN_WEAR,
                    maxWear: Config.DEFAULT_VALUES.MAX_WEAR
                };
            }
        }

        const selectElement = document.getElementById('materialTypeCountSelect');
        if (selectElement) {
            selectElement.value = '1';
            this.typeCount = 1;
        }

        const containers = document.getElementById('materialTypeContainers');
        if (containers) {
            containers.innerHTML = '';
            this.createTypeContainer(1);
        }
    }

    static createTypeContainer(index) {
        const containers = document.getElementById('materialTypeContainers');
        if (!containers) return;

        const container = document.createElement('div');
        container.className = 'material-type-container';
        container.id = `materialType${index}`;
        container.innerHTML = `
            <div class="material-type-header">
                <div class="material-type-color material-type-${index}"></div>
                <h4>材料种类 ${index}</h4>
            </div>
            <div class="material-wear-range">
                <div style="flex: 2; position: relative;">
                    <h4>选择材料</h4>
                    <div class="material-search-container">
                        <input type="text" id="materialSearch${index}" class="material-search-input" placeholder="搜索材料名称..." oninput="MaterialSearch.search(${index}, this.value, 'special')" onfocus="MaterialSearch.showDropdown(${index}, 'special')" onblur="MaterialSearch.hideDropdown(${index}, 'special')">
                        <div id="materialDropdown${index}" class="material-dropdown"></div>
                    </div>
                </div>
                <div style="flex: 1; min-width: 170px;">
                    <div class="wear-range-display">
                        <div class="wear-range-label">磨损区间</div>
                        <div id="wearRangeDisplay${index}" class="wear-range-value">0.000000-0.800000</div>
                    </div>
                </div>
            </div>
            <textarea id="fcAltInput${index}" class="material-type-textarea" placeholder="输入材料种类 ${index} 的磨损数据..."></textarea>
            <div class="material-type-buttons">
                <button class="primary" onclick="MaterialManager.extractFloats(${index})">提取数据</button>
            </div>
            <textarea id="fcOutput${index}" class="material-type-output" readonly placeholder="提取的材料数据将显示在这里"></textarea>
            <textarea id="fcCumulative${index}" class="material-type-output" readonly placeholder="累计的材料数据将显示在这里"></textarea>
            <div class="material-type-buttons">
                <button class="secondary" onclick="MaterialManager.copy(${index})">复制数据</button>
                <button class="primary" onclick="MaterialManager.mergeToTotal(${index})">汇总数据</button>
                <button class="secondary" onclick="MaterialManager.clearType(${index})">清除数据</button>
            </div>
        `;
        containers.appendChild(container);
        this.restoreData(index);
    }

    static updateCount() {
        const newCount = parseInt(document.getElementById('materialCountSelect').value);
        if (newCount !== this.count) {
            this.count = newCount;

            if (TabManager.getActive() === 'floatCombosDiv') {
                this._resetSpecialWearTab();
            }

            this.currentGrade = null;

            this.filterByRule();

            CombinationCalculator.updatePreview();

            MessageManager.show(`已切换为${newCount}个材料，数据已重置`, 'info');
        }
    }

    static _resetSpecialWearTab() {
        for (let i = 1; i <= this.typeCount; i++) {
            this.clearType(i);
        }

        document.getElementById('fcAltInput').value = '';

        document.getElementById('fcCminwearinput').value = Config.DEFAULT_VALUES.MIN_WEAR;
        document.getElementById('fcCmaxwearinput').value = '';
        document.getElementById('fcCdesiredfloatinput').value = '';
        document.getElementById('fcCspecificityinput').value = Config.DEFAULT_VALUES.SPECIFICITY;

        document.getElementById('fcCombinationsText').innerHTML = '';
        document.getElementById('fcTotalCombosText').textContent = '等待计算...';

        const progressBar = document.getElementById('fcProgressBar');
        if (progressBar) progressBar.style.width = '0%';

        const searchInput = document.getElementById('searchInput');
        const searchStatus = document.getElementById('searchStatus');
        if (searchInput) searchInput.value = '';
        if (searchStatus) searchStatus.textContent = '未搜索';

        const ieeeDisplay = document.getElementById('targetWearIEEEDisplay');
        const ieeeValue = document.getElementById('targetWearIEEEValue');
        if (ieeeDisplay) ieeeDisplay.style.display = 'none';
        if (ieeeValue) ieeeValue.textContent = '';
    }

    static updateTypeCount() {
        const newCount = parseInt(document.getElementById('materialTypeCountSelect').value);
        const currentCount = this.typeCount;

        for (let i = 1; i <= currentCount; i++) {
            this.saveData(i);
        }

        const containers = document.getElementById('materialTypeContainers');
        if (!containers) return;

        if (newCount > currentCount) {
            for (let i = currentCount + 1; i <= newCount; i++) {
                this.createTypeContainer(i);
            }
        } else if (newCount < currentCount) {
            for (let i = currentCount; i > newCount; i--) {
                const container = document.getElementById(`materialType${i}`);
                if (container) container.remove();
            }
        }

        this.typeCount = newCount;

        for (let i = 1; i <= newCount; i++) {
            this.restoreData(i);
        }
    }

    static saveData(index) {
        if (this.data[index]) {
            this.data[index].input = document.getElementById(`fcAltInput${index}`)?.value || '';
            this.data[index].output = document.getElementById(`fcOutput${index}`)?.value || '';
            this.data[index].cumulative = document.getElementById(`fcCumulative${index}`)?.value || '';
            this.data[index].minWear = document.getElementById(`materialMinWear${index}`)?.value || Config.DEFAULT_VALUES.MIN_WEAR;
            this.data[index].maxWear = document.getElementById(`materialMaxWear${index}`)?.value || Config.DEFAULT_VALUES.MAX_WEAR;
        }
    }

    static restoreData(index) {
        if (this.data[index]) {
            const inputElem = document.getElementById(`fcAltInput${index}`);
            const outputElem = document.getElementById(`fcOutput${index}`);
            const cumulativeElem = document.getElementById(`fcCumulative${index}`);

            if (inputElem) inputElem.value = this.data[index].input;
            if (outputElem) outputElem.value = this.data[index].output;
            if (cumulativeElem) cumulativeElem.value = this.data[index].cumulative;
        }
    }

    static extractFloats(index) {
        const inputText = document.getElementById(`fcAltInput${index}`).value;
        const outputText = document.getElementById(`fcOutput${index}`);
        const cumulativeResults = document.getElementById(`fcCumulative${index}`);
        const searchInput = document.getElementById(`materialSearch${index}`);
        const wearRangeDisplay = document.getElementById(`wearRangeDisplay${index}`);

        if (!inputText || inputText.trim() === '') {
            MessageManager.show('请输入要提取的数据', 'error');
            return;
        }

        if (searchInput && searchInput.value.trim() === '') {
            const matchedMaterial = MaterialFinder.findFromText(inputText);

            if (matchedMaterial) {
                const materialCount = parseInt(document.getElementById('materialCountSelect').value) || 5;
                const validation = MaterialValidator.validateForSynthesis(matchedMaterial, this.currentGrade, materialCount);

                if (!validation.valid) {
                    MessageManager.show(validation.message, 'warning');
                } else {
                    searchInput.value = matchedMaterial.name;

                    if (wearRangeDisplay) {
                        wearRangeDisplay.textContent = `${matchedMaterial.min.toFixed(6)}-${matchedMaterial.max.toFixed(6)}`;
                        wearRangeDisplay.style.color = '#28a745';
                    }

                    if (this.data[index]) {
                        this.data[index].minWear = matchedMaterial.min;
                        this.data[index].maxWear = matchedMaterial.max;
                        this.data[index].grade = matchedMaterial.grade;

                        for (const [id, material] of Object.entries(materialDatabase)) {
                            if (material.name === matchedMaterial.name) {
                                this.data[index].materialId = id;
                                break;
                            }
                        }
                    }

                    if (!this.currentGrade) {
                        this.currentGrade = matchedMaterial.grade;
                        MessageManager.show(`已设置为${Config.GRADE_NAMES[matchedMaterial.grade]}材料，后续材料必须为同等级`, 'info');
                    }
                }
            }
        }

        const extractedFloats = this._extractFloatsFromText(inputText);

        if (!extractedFloats) {
            MessageManager.show('未找到有效的磨损数据', 'error');
            return;
        }

        outputText.value = extractedFloats;
        if (cumulativeResults.value && cumulativeResults.value.trim() !== '') {
            cumulativeResults.value += ", " + extractedFloats;
        } else {
            cumulativeResults.value = extractedFloats;
        }

        document.getElementById(`fcAltInput${index}`).value = "";
        this.saveData(index);
        CombinationCalculator.updatePreview();
        MessageManager.show(`材料种类 ${index} 数据提取成功`, 'success');
    }

    static _extractFloatsFromText(input) {
        if (!input) return null;
        const regex = /0?\.\d{4,}(?:e[+-]?\d+)?/gi;
        const matches = input.match(regex);
        if (!matches || matches.length === 0) return null;

        const validFloats = matches.filter(floatStr => {
            const floatVal = parseFloat(floatStr);
            return !isNaN(floatVal) && floatVal >= 0 && floatVal <= 1;
        });

        if (validFloats.length === 0) return null;
        return validFloats.join(", ");
    }

    static copy(index) {
        const cumulativeResults = document.getElementById(`fcCumulative${index}`);
        cumulativeResults.select();
        document.execCommand("copy");
        MessageManager.show(`材料种类 ${index} 数据已复制`, 'success');
    }

    static mergeToTotal(index) {
        const cumulativeResults = document.getElementById(`fcCumulative${index}`).value;
        const totalInput = document.getElementById("fcAltInput");

        if (!cumulativeResults) {
            MessageManager.show(`材料种类 ${index} 没有数据可汇总`, 'error');
            return;
        }

        const markedData = cumulativeResults.split(',').map(item => {
            const trimmed = item.trim();
            return trimmed ? `${trimmed}|${index}` : '';
        }).filter(item => item).join(', ');

        const currentTotalData = totalInput.value.split(',').map(item => {
            const parts = item.trim().split('|');
            return parts[0];
        }).filter(item => item);

        const cumulativeArray = cumulativeResults.split(',').map(item => item.trim()).filter(item => item);
        const existingSet = new Set(currentTotalData);
        const newData = cumulativeArray.filter(item => !existingSet.has(item));

        if (newData.length === 0) {
            MessageManager.show(`材料种类 ${index} 的数据已经全部汇总过了`, 'info');
            return;
        }

        const newMarkedData = newData.map(item => `${item}|${index}`).join(', ');
        totalInput.value = totalInput.value ? totalInput.value + ", " + newMarkedData : newMarkedData;
        MessageManager.show(`材料种类 ${index} 的 ${newData.length} 条新数据已汇总到总数据中`, 'success');
    }

    static clearType(index) {
        const inputTextarea = document.getElementById(`fcAltInput${index}`);
        const outputTextarea = document.getElementById(`fcOutput${index}`);
        const cumulativeTextarea = document.getElementById(`fcCumulative${index}`);
        const searchInput = document.getElementById(`materialSearch${index}`);
        const wearRangeDisplay = document.getElementById(`wearRangeDisplay${index}`);

        if (inputTextarea) inputTextarea.value = "";
        if (outputTextarea) outputTextarea.value = "";
        if (cumulativeTextarea) cumulativeTextarea.value = "";
        if (searchInput) searchInput.value = "";
        if (wearRangeDisplay) {
            wearRangeDisplay.textContent = "0.000000-0.800000";
            wearRangeDisplay.style.color = "";
        }
        if (this.data[index]) {
            this.data[index] = {
                input: '',
                output: '',
                cumulative: '',
                minWear: Config.DEFAULT_VALUES.MIN_WEAR,
                maxWear: Config.DEFAULT_VALUES.MAX_WEAR,
                grade: null,
                materialId: null
            };
        }

        let hasOtherMaterial = false;
        for (let i = 1; i <= this.typeCount; i++) {
            if (i !== index) {
                const otherSearchInput = document.getElementById(`materialSearch${i}`);
                if (otherSearchInput && otherSearchInput.value.trim()) {
                    hasOtherMaterial = true;
                    break;
                }
            }
        }

        if (!hasOtherMaterial) {
            this.currentGrade = null;
        }

        MessageManager.show(`材料种类 ${index} 数据已清除`, 'info');
    }

    static clearCurrentTab() {
        for (let i = 1; i <= this.typeCount; i++) {
            this.clearType(i);
        }

        this._clearSpecialWearTabElements();

        this.currentGrade = null;
        this.filterByRule();
        CombinationCalculator.updatePreview();

        MessageManager.show('特殊磨损页数据已清空', 'success');
    }

    static _clearSpecialWearTabElements() {
        CleanupManager.clearAllInputs([
            'fcAltInput',
            'fcCdesiredfloatinput',
            'fcCmaxwearinput',
            'searchInput'
        ]);

        document.getElementById('fcCombinationsText').innerHTML = '';
        document.getElementById('fcTotalCombosText').textContent = '等待计算...';
        document.getElementById('searchStatus').textContent = '未搜索';

        const progressBar = document.getElementById('fcProgressBar');
        if (progressBar) progressBar.style.width = '0%';

        const ieeeDisplay1 = document.getElementById('targetWearIEEEDisplay');
        const ieeeValue1 = document.getElementById('targetWearIEEEValue');
        if (ieeeDisplay1) ieeeDisplay1.style.display = 'none';
        if (ieeeValue1) ieeeValue1.textContent = '';

        const ieeeDisplay2 = document.getElementById('autoTargetWearIEEEDisplay');
        const ieeeValue2 = document.getElementById('autoTargetWearIEEEValue');
        if (ieeeDisplay2) ieeeDisplay2.style.display = 'none';
        if (ieeeValue2) ieeeValue2.textContent = '';
    }

    static filterByRule() {
        const materialCount = this.count;
        let allowedGrades = [];
        let message = '';

        if (materialCount === 5) {
            allowedGrades = ['covert'];
            message = '5个材料合成：只能选择隐秘级材料（用于合成刀/手套）';
        } else if (materialCount === 10) {
            allowedGrades = ['consumer', 'industrial', 'milspec', 'restricted', 'classified'];
            message = '10个材料合成：请选择消费级、工业级、军规级、受限级或保密级材料';
        }

        if (message) {
            MessageManager.show(message, 'info');
        }

        return allowedGrades;
    }
}

class MaterialSearch {
    static search(index, searchTerm, type = 'special') {
        const dropdownId = this._getDropdownId(index, type);
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        if (!searchTerm.trim()) {
            dropdown.innerHTML = '';
            dropdown.style.display = 'none';
            return;
        }

        const allowedGrades = this._getAllowedGrades(type);
        const filteredMaterials = this._filterMaterials(searchTerm, allowedGrades);
        this._updateDropdown(dropdown, filteredMaterials, index, type);
    }

    static _getDropdownId(index, type) {
        const prefixes = {
            'special': 'materialDropdown',
            'simple': 'simpleMaterialDropdown',
            'auto': 'autoMaterialDropdown'
        };
        return `${prefixes[type] || 'materialDropdown'}${index}`;
    }

    static _getAllowedGrades(type) {
        const selectId = {
            'special': 'materialCountSelect',
            'simple': 'simpleMaterialCount',
            'auto': 'autoMaterialCount'
        }[type];

        const select = document.getElementById(selectId);
        const materialCount = select ? parseInt(select.value) : 5;

        const currentGrade = this._getCurrentGrade(type);
        if (currentGrade) {
            return [currentGrade];
        }

        if (materialCount === 5) {
            return ['covert'];
        } else if (materialCount === 10) {
            return ['consumer', 'industrial', 'milspec', 'restricted', 'classified'];
        }

        return [];
    }

    static _getCurrentGrade(type) {
        if (type === 'special') {
            return MaterialManager.currentGrade;
        }

        const prefix = {
            'simple': 'simpleMaterialSelect',
            'auto': 'autoMaterialSelect'
        }[type];

        if (!prefix) return null;

        const countSelectId = {
            'simple': 'simpleMaterialCount',
            'auto': 'autoMaterialCount'
        }[type];
        const countSelect = document.getElementById(countSelectId);
        const count = countSelect ? parseInt(countSelect.value) : 5;

        for (let i = 1; i <= count; i++) {
            const input = document.getElementById(`${prefix}${i}`);
            if (input && input.value.trim()) {
                const material = MaterialFinder.findByName(input.value);
                if (material && material.grade) {
                    return material.grade;
                }
            }
        }

        return null;
    }

    static _filterMaterials(searchTerm, allowedGrades) {
        return Object.entries(materialDatabase).filter(([id, material]) => {
            if (allowedGrades.length > 0 && !allowedGrades.includes(material.grade)) {
                return false;
            }
            return material.name.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }

    static _updateDropdown(dropdown, filteredMaterials, index, type) {
        if (filteredMaterials.length === 0) {
            dropdown.innerHTML = '<div class="material-dropdown-item" style="color: #6c757d; text-align: center;">未找到匹配的材料</div>';
            dropdown.style.display = 'block';
            return;
        }

        let html = '';
        filteredMaterials.slice(0, 10).forEach(([id, material]) => {
            const gradeText = MaterialFinder.getGradeChineseName(material.grade);
            const gradeClass = `grade-${material.grade}`;
            html += `
                <div class="material-dropdown-item" onclick="MaterialSearch.select(${index}, '${id}', '${type}')" onmouseover="this.classList.add('selected')" onmouseout="this.classList.remove('selected')">
                    <div style="font-weight: 500;">${material.name}</div>
                    <div style="font-size: 12px; color: #6c757d; margin-top: 2px;">
                        <span class="material-grade-badge ${gradeClass}">${gradeText}</span>
                        <span style="margin-left: 5px;">${material.min.toFixed(6)}-${material.max.toFixed(6)}</span>
                    </div>
                </div>
            `;
        });

        dropdown.innerHTML = html;
        dropdown.style.display = 'block';
    }

    static select(index, materialId, type = 'special') {
        const material = materialDatabase[materialId];
        if (!material) return;

        const { selectId, rangeId } = this._getElementIds(index, type);
        const materialSelect = document.getElementById(selectId);
        const rangeDisplay = document.getElementById(rangeId);

        if (materialSelect) materialSelect.value = material.name;
        if (rangeDisplay) {
            rangeDisplay.textContent = `${material.min.toFixed(6)}-${material.max.toFixed(6)}`;
            rangeDisplay.style.color = '#28a745';
        }

        this.hideDropdown(index, type);

        const materialCount = this._getMaterialCount(type);
        const currentGrade = this._getCurrentGrade(type);

        const validation = MaterialValidator.validateForSynthesis(material, currentGrade, materialCount, 'selection');
        if (!validation.valid) {
            MessageManager.show(validation.message, 'error');
            if (materialSelect) materialSelect.value = '';
            if (rangeDisplay) {
                rangeDisplay.textContent = '0.000000-0.800000';
                rangeDisplay.style.color = '';
            }
            return;
        }

        if (!currentGrade && type !== 'special') {
            MessageManager.show(`已选择${Config.GRADE_NAMES[material.grade]}材料，后续材料必须为同等级`, 'info');
        }

        if (type === 'special' && !MaterialManager.currentGrade) {
            MaterialManager.currentGrade = material.grade;
            MessageManager.show(`已选择${Config.GRADE_NAMES[material.grade]}材料，后续材料必须为同等级`, 'info');
        }

        if (type === 'auto') {
            setTimeout(() => AutoMaterialCalculator.recalculate(), 50);
        }
    }

    static _getMaterialCount(type) {
        const selectId = {
            'special': 'materialCountSelect',
            'simple': 'simpleMaterialCount',
            'auto': 'autoMaterialCount'
        }[type];

        const select = document.getElementById(selectId);
        return select ? parseInt(select.value) : 5;
    }

    static _getElementIds(index, type) {
        const ids = {
            'special': {
                selectId: `materialSearch${index}`,
                rangeId: `wearRangeDisplay${index}`
            },
            'simple': {
                selectId: `simpleMaterialSelect${index}`,
                rangeId: `simpleMaterialRange${index}`
            },
            'auto': {
                selectId: `autoMaterialSelect${index}`,
                rangeId: `autoMaterialRange${index}`
            }
        };
        return ids[type] || ids.special;
    }

    static showDropdown(index, type = 'special') {
        const selectId = this._getElementIds(index, type).selectId;
        const searchInput = document.getElementById(selectId);
        if (searchInput && searchInput.value.trim()) {
            this.search(index, searchInput.value, type);
        }
    }

    static hideDropdown(index, type = 'special') {
        setTimeout(() => {
            const dropdownId = this._getDropdownId(index, type);
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) dropdown.style.display = 'none';
        }, 200);
    }
}

class CombinationCalculator {
    static inProgress = false;
    static terminated = false;
    static currentCalculation = null;
    static batchResults = [];

    static start() {
        document.getElementById("fcCombinationsText").innerHTML = '';
        document.getElementById("fcTotalCombosText").textContent = '等待计算...';
        const progressBar = document.getElementById("fcProgressBar");
        if (progressBar) progressBar.style.width = '0%';
        if (this.inProgress) {
            this.terminate();
            setTimeout(() => this._startNewCalculation(), 100);
        } else {
            this._startNewCalculation();
        }
    }

    static _startNewCalculation() {
        this._resetState();

        setTimeout(() => {
            if (!this._validateInputs()) return;

            const inputText = document.getElementById("fcAltInput").value;
            if (!inputText || inputText.trim() === '') {
                MessageManager.show('请先在数据处理框中输入材料数据！', 'error');
                return;
            }

            this.inProgress = true;
            MessageManager.setLoading(true);

            const { originalFloatList, floatList, materialTypeList } = this._parseInputData(inputText);

            if (floatList.length < MaterialManager.count) {
                MessageManager.show(`最少需要输入${MaterialManager.count}个材料，当前只有${floatList.length}个`, 'error');
                MessageManager.setLoading(false);
                this.inProgress = false;
                return;
            }

            const totalCombos = Utils.combinations(floatList.length, MaterialManager.count);
            document.getElementById("fcTotalCombosText").textContent =
                `总组合数: ${totalCombos.toLocaleString()} (基于 ${floatList.length} 个材料)`;

            this._calculateCombinations(floatList, originalFloatList, materialTypeList);
        }, 0);
    }

    static _resetState() {
        this.inProgress = false;
        this.terminated = false;
        this.batchResults = [];
        const progressBar = document.getElementById("fcProgressBar");
        if (progressBar) progressBar.style.width = '0%';
        document.getElementById("fcTotalCombosText").textContent = '等待计算...';
        const stopButton = document.getElementById('stopButton');
        if (stopButton) {
            stopButton.disabled = true;
            stopButton.textContent = '终止计算';
        }
    }

    static _validateInputs() {
        const maxWear = parseFloat(document.getElementById('fcCmaxwearinput').value);
        const minWear = parseFloat(document.getElementById('fcCminwearinput').value);
        const desiredFloat = parseFloat(document.getElementById('fcCdesiredfloatinput').value);
        const specificity = parseFloat(document.getElementById('fcCspecificityinput').value);

        if (isNaN(maxWear) || isNaN(minWear) || isNaN(desiredFloat) || isNaN(specificity)) {
            MessageManager.show('请输入有效的数值', 'error');
            return false;
        }

        if (minWear >= maxWear) {
            MessageManager.show('最小磨损必须小于最大磨损', 'error');
            return false;
        }

        if (specificity === 0 && isNaN(desiredFloat)) {
            MessageManager.show('精确度为0时，必须输入有效的目标磨损值', 'error');
            return false;
        }

        return true;
    }

    static _parseInputData(inputText) {
        let originalFloatList = [];
        let floatList = [];
        let materialTypeList = [];

        inputText.split(',').forEach(item => {
            const parts = item.trim().split('|');
            const current = parseFloat(parts[0]);
            const materialType = parts[1] ? parseInt(parts[1]) : 1;

            if (!isNaN(current) && current % 1 !== 0) {
                originalFloatList.push(current);
                floatList.push(this._normalizeWearForCalculation(current, materialType));
                materialTypeList.push(materialType);
            }
        });

        return { originalFloatList, floatList, materialTypeList };
    }
    static _normalizeWearForCalculation(wearValue, materialTypeIndex) {
        const wearRangeDisplay = document.getElementById(`wearRangeDisplay${materialTypeIndex}`);
        if (!wearRangeDisplay) return wearValue;

        const rangeText = wearRangeDisplay.textContent;
        const [minStr, maxStr] = rangeText.split('-').map(s => s.trim());

        const materialMinWear = Utils.getIEEE754(parseFloat(minStr) || 0);
        const materialMaxWear = Utils.getIEEE754(parseFloat(maxStr) || 1);

        if (materialMaxWear - materialMinWear <= 0) {
            return 0;
        }

        const normalized = Utils.getIEEE754(
            (wearValue - materialMinWear) / (materialMaxWear - materialMinWear)
        );

        return Math.max(0, Math.min(1, normalized));
    }
    static async _calculateCombinations(arr, originalArr, materialTypes) {
        this.batchResults = [];
        this.terminated = false;

        const combinationstext = document.getElementById("fcCombinationsText");
        const progress_bar = document.getElementById("fcProgressBar");
        const total_combos = Utils.combinations(arr.length, MaterialManager.count);
        const max_wear = Utils.getIEEE754(Number(document.getElementById('fcCmaxwearinput').value));
        const min_wear = Utils.getIEEE754(Number(document.getElementById('fcCminwearinput').value));
        const desired_ieee = Utils.getIEEE754(Number(document.getElementById('fcCdesiredfloatinput').value));
        const desired_float = Number(document.getElementById('fcCdesiredfloatinput').value);
        const specificity = Number(document.getElementById('fcCspecificityinput').value);

        let progress = 0;
        let lastUpdateTime = Date.now();

        const rows = [];
        const positions = [];

        for (let i = 0; i < MaterialManager.count; i++) {
            const copy = arr.slice(0);
            rows.push(copy);
            positions.push(i);
        }

        let done = false;
        const updateFrequency = MaterialManager.count === 10 ? 1000000 : 50000;

        while (!done && !this.terminated) {
            let combo = [];
            let originalCombo = [];
            let materialTypeCombo = [];

            for (let row = 0; row < rows.length; row++) {
                combo.push(rows[row][positions[row]]);
                originalCombo.push(originalArr[positions[row]]);
                materialTypeCombo.push(materialTypes[positions[row]]);
            }

            let undefinedCount = 0;
            for (let i = 0; i < combo.length; i++) {
                if (combo[i] === undefined) undefinedCount++;
            }
            if (undefinedCount >= MaterialManager.count) {
                done = true;
            }

            if (combo.indexOf(undefined) < 0 && !this.terminated) {
                let normalizedSum = 0;
                for (let i = 0; i < MaterialManager.count; i++) {
                    normalizedSum = Utils.getIEEE754(normalizedSum + combo[i]);
                }

                let avgNormalized = Utils.getIEEE754(normalizedSum / Utils.getIEEE754(MaterialManager.count));
                let wear = Utils.getIEEE754(min_wear + Utils.getIEEE754(avgNormalized * Utils.getIEEE754(max_wear - min_wear)));

                const isExactMatch = (specificity === 0 && wear == desired_ieee) ||
                    (specificity === 0 && Utils.truncateDecimals(wear, Utils.countDecimals(desired_float)) == desired_float) ||
                    (wear == desired_ieee);

                if (isExactMatch || (wear >= desired_ieee && wear <= (Number(desired_ieee) + Number(specificity)))) {
                    const materialsText = originalCombo.map((val, index) => {
                        const typeIndex = materialTypeCombo[index];
                        return `<span class="text-material-type-${typeIndex}">${Utils.getIEEE754(val)}</span>`;
                    }).join(' + ');

                    this._addToBatch(wear, materialsText, isExactMatch);
                }

                progress++;
            }

            if (!this.terminated) {
                positions[rows.length - 1]++;
                for (let a = positions.length - 1; a >= 0; a -= 1) {
                    if (positions[a] >= arr.length) {
                        if (a - 1 >= 0) {
                            positions[a - 1]++;
                            for (let b = a; b < positions.length; b++) {
                                positions[b] = positions[b - 1] + 1;
                            }
                        }
                    }
                }
            }

            const currentTime = Date.now();
            if ((currentTime - lastUpdateTime > 100 || progress % updateFrequency === 0) && !this.terminated) {
                const percent_done = ((progress / total_combos) * 100).toFixed(2);
                if (progress_bar) progress_bar.style.width = percent_done + '%';
                lastUpdateTime = currentTime;

                this._flushBatch();

                if (progress % updateFrequency === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            if (progress >= total_combos) {
                done = true;
            }
        }

        this._flushBatch();

        if (this.terminated) {
            const percent_done = ((progress / total_combos) * 100).toFixed(2);
            if (progress_bar) progress_bar.style.width = percent_done + '%';
            MessageManager.show(`计算已终止，已完成 ${progress.toLocaleString()} 个组合`, 'info');
        } else {
        if (progress_bar) progress_bar.style.width = '100%';
        
        const resultsContainer = document.getElementById("fcCombinationsText");
        const resultCount = resultsContainer.querySelectorAll('.real-time-result').length;
        
        if (resultCount === 0) {
            combinationstext.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">未找到符合条件的组合</div>';
            MessageManager.show('计算完成，未找到符合条件的组合', 'info');
        } else {
            MessageManager.show(`计算完成！找到 ${resultCount} 个有效组合`, 'success');
        }
    }

        MessageManager.setLoading(false);
        this.inProgress = false;
        this.terminated = false;
        this.currentCalculation = null;
    }

    static _addToBatch(wear, materialsText, isExactMatch) {
        const wearClass = isExactMatch ? 'exact-match-highlight' : 'normal-wear';
        this.batchResults.push(`
            <div class="real-time-result">
                <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <div style="flex-shrink: 0;">
                        <strong>磨损:</strong> <span class="${wearClass}">${wear}</span>
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <strong>组合:</strong> ${materialsText}
                    </div>
                </div>
            </div>
        `);

        if (this.batchResults.length >= Config.BATCH_SIZE) {
            this._flushBatch();
        }
    }

    static _flushBatch() {
        if (this.batchResults.length === 0) return;

        const combinationstext = document.getElementById("fcCombinationsText");
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.batchResults.join('');

        while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
        }

        combinationstext.appendChild(fragment);
        combinationstext.scrollTop = combinationstext.scrollHeight;
        this.batchResults = [];
    }

    static terminate() {
        if (this.inProgress) {
            this.terminated = true;
            MessageManager.show('正在终止计算...', 'info');

            const stopButton = document.getElementById('stopButton');
            if (stopButton) {
                stopButton.disabled = true;
                stopButton.textContent = '正在终止...';
            }
        }
    }

    static updatePreview() {
        const totalcombostext = document.getElementById("fcTotalCombosText");
        const altFloats = document.getElementById("fcAltInput").value;

        let float_list = [];
        if (altFloats && altFloats.trim() !== '') {
            altFloats.split(',').forEach(item => {
                const parts = item.trim().split('|');
                const current = parseFloat(parts[0]);
                if (!isNaN(current) && current % 1 !== 0) {
                    float_list.push(current);
                }
            });
        }

        if (float_list.length >= MaterialManager.count) {
            const total_combos = Utils.combinations(float_list.length, MaterialManager.count);
            totalcombostext.innerHTML = "可能有这么多结果: " + total_combos.toLocaleString();
        } else {
            totalcombostext.innerHTML = "等待计算...";
        }
    }
}

class SimpleWearCalculator {
    static count = 5;

    static updateTable() {
        const countSelect = document.getElementById('simpleMaterialCount');
        const tableBody = document.getElementById('materialTableBody');
        if (!countSelect || !tableBody) return;

        this.count = parseInt(countSelect.value) || 5;
        tableBody.innerHTML = '';

        for (let i = 1; i <= this.count; i++) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${i}</td>
                <td>
                    <input type="text" id="materialWear${i}" placeholder="输入磨损值" oninput="InputValidator.number(this)">
                </td>
                <td>
                    <div class="material-search-container">
                        <input type="text" id="simpleMaterialSelect${i}" class="material-search-input" placeholder="搜索材料名称" oninput="MaterialSearch.search(${i}, this.value, 'simple')" onfocus="MaterialSearch.showDropdown(${i}, 'simple')" onblur="MaterialSearch.hideDropdown(${i}, 'simple')">
                        <div id="simpleMaterialDropdown${i}" class="material-dropdown"></div>
                    </div>
                </td>
                <td>
                    <span id="simpleMaterialRange${i}" class="range-text">0.000000-1.000000</span>
                </td>
            `;
            tableBody.appendChild(row);
        }

        MaterialManager.currentGrade = null;
        MessageManager.show(`已切换为${this.count}个材料，表格已重建`, 'info');
    }

    static calculateWithProbability() {
        const materials = [];
        for (let i = 1; i <= this.count; i++) {
            const wearInput = document.getElementById(`materialWear${i}`);
            const materialSelect = document.getElementById(`simpleMaterialSelect${i}`);

            if (!wearInput || !materialSelect) continue;

            const wearValue = wearInput.value.trim();
            const materialName = materialSelect.value.trim();

            if (!wearValue || !materialName) {
                MessageManager.show(`材料 ${i} 的磨损值和材料名称都必须填写`, 'error');
                return;
            }

            const wear = parseFloat(wearValue);
            if (isNaN(wear) || wear < 0 || wear > 1) {
                MessageManager.show(`材料 ${i} 的磨损值必须在0-1之间`, 'error');
                return;
            }

            const material = MaterialFinder.findByName(materialName);
            if (!material) {
                MessageManager.show(`材料 ${i} 未找到对应皮肤数据`, 'error');
                return;
            }

            materials.push({ wear, material, hasSpecificMaterial: true });
        }

        if (materials.length !== this.count) {
            MessageManager.show(`必须输入所有 ${this.count} 个材料的数据`, 'error');
            return;
        }

        const wearResult = this._calculateAccurateWear(materials);
        const possibleProducts = this._getPossibleProducts(materials);

        if (possibleProducts && possibleProducts.length > 0) {
            this._displayProductProbabilities(possibleProducts, wearResult, materials);
            MessageManager.show(`计算完成！找到 ${possibleProducts.length} 个可能产物`, 'success');
        }
    }

    static _calculateAccurateWear(materials) {
        let totalNormalized = 0;
        const materialInfo = [];

        for (const item of materials) {
            const wear = Utils.getIEEE754(item.wear);
            const min = Utils.getIEEE754(item.material.min);
            const max = Utils.getIEEE754(item.material.max);

            const wearMinusMin = Utils.getIEEE754(wear - min);
            const maxMinusMin = Utils.getIEEE754(max - min);

            let normalized = 0;
            if (maxMinusMin !== 0) {
                normalized = Utils.getIEEE754(wearMinusMin / maxMinusMin);
            }

            normalized = Math.max(0, Math.min(1, normalized));
            totalNormalized = Utils.getIEEE754(totalNormalized + normalized);

            materialInfo.push({ wear, min, max, normalized, name: item.material.name });
        }

        const avgNormalized = materials.length > 0
            ? Utils.getIEEE754(totalNormalized / Utils.getIEEE754(materials.length))
            : 0;

        return { avgNormalized, materialInfo };
    }

    static _getPossibleProducts(materials) {
        const specificMaterials = materials.map(item => item.material);
        if (specificMaterials.length === 0) {
            MessageManager.show('所有材料必须选择具体的皮肤才能计算产物概率', 'error');
            return [];
        }

        const firstGrade = specificMaterials[0].grade;
        for (let i = 1; i < specificMaterials.length; i++) {
            if (specificMaterials[i].grade !== firstGrade) {
                MessageManager.show('所有材料必须是同一等级', 'error');
                return [];
            }
        }

        if (this.count === 5 && firstGrade !== 'covert') {
            MessageManager.show('5个材料合成时只能选择隐秘级材料', 'error');
            return [];
        }

        if (this.count === 10 && firstGrade === 'covert') {
            MessageManager.show('10个材料合成时不能选择隐秘级材料', 'error');
            return [];
        }

        const targetGrade = this._getSynthesisTargetGrade(firstGrade);
        if (!targetGrade) {
            MessageManager.show('无法确定目标产物等级', 'error');
            return [];
        }

        const sourceMaterialCount = new Map();

        for (const material of specificMaterials) {
            if (material.crates) {
                for (const crateName of material.crates) {
                    const sourceKey = `crate:${crateName}`;
                    sourceMaterialCount.set(sourceKey, (sourceMaterialCount.get(sourceKey) || 0) + 1);
                }
            }

            if (material.collections) {
                for (const collectionName of material.collections) {
                    const sourceKey = `collection:${collectionName}`;
                    sourceMaterialCount.set(sourceKey, (sourceMaterialCount.get(sourceKey) || 0) + 1);
                }
            }
        }

        let validSources = [];
        for (const [sourceKey, count] of sourceMaterialCount) {
            const [sourceType, sourceName] = sourceKey.split(':');
            const source = crateDatabase[sourceName];

            if (source && source[targetGrade] && source[targetGrade].length > 0) {
                validSources.push({
                    type: sourceType,
                    name: sourceName,
                    materialCount: count,
                    products: source[targetGrade]
                });
            }
        }

        if (validSources.length === 0) {
            MessageManager.show('所选材料没有共同的上级产物来源', 'error');
            return [];
        }

        const totalMaterials = specificMaterials.length;
        const productMap = new Map();

        for (const source of validSources) {
            const sourceProbability = (source.materialCount / totalMaterials) * 100;
            const productProbability = sourceProbability / source.products.length;

            for (const productName of source.products) {
                const productInfo = MaterialFinder.findByName(productName);
                if (!productInfo) continue;

                if (!productMap.has(productName)) {
                    productMap.set(productName, {
                        name: productName,
                        grade: targetGrade,
                        min: productInfo.min,
                        max: productInfo.max,
                        probability: 0,
                        sources: new Map()
                    });
                }

                const product = productMap.get(productName);
                product.probability = Utils.getIEEE754(product.probability + productProbability);
                product.sources.set(`${source.type}:${source.name}`, {
                    type: source.type,
                    name: source.name,
                    materialCount: source.materialCount
                });
            }
        }

        const products = Array.from(productMap.values());
        if (products.length === 0) {
            MessageManager.show('在所选材料来源中未找到目标等级的产物', 'error');
            return [];
        }

        let totalProbability = products.reduce((sum, p) => sum + p.probability, 0);
        if (Math.abs(totalProbability - 100) > 0.0001) {
            const adjustmentFactor = 100 / totalProbability;
            products.forEach(p => {
                p.probability = Utils.getIEEE754(p.probability * adjustmentFactor);
            });
        }

        products.forEach(product => {
            const sourceList = [];
            for (const [sourceKey, sourceInfo] of product.sources) {
                sourceList.push(sourceInfo.name);
            }
            product.sourceInfo = sourceList.join('、');
        });

        products.sort((a, b) => b.probability - a.probability);
        return products;
    }

    static _getSynthesisTargetGrade(materialGrade) {
        if (this.count === 5 && materialGrade === 'covert') {
            return 'ancient';
        }

        if (this.count === 10) {
            const gradeOrder = ['consumer', 'industrial', 'milspec', 'restricted', 'classified'];
            const currentIndex = gradeOrder.indexOf(materialGrade);
            if (currentIndex < gradeOrder.length - 1) {
                return gradeOrder[currentIndex + 1];
            }
            if (materialGrade === 'classified') {
                return 'covert';
            }
        }

        return null;
    }

    static _displayProductProbabilities(products, wearResult, materials) {
        const resultsContainer = document.getElementById('productProbabilityResults');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = '';
        const materialGrade = materials[0].material.grade;

        let html = '<div class="product-probability-container">';
        html += `
            <div class="synthesis-summary">
                <h4>合成分析</h4>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">合成方案</div>
                        <div class="summary-value">
                            ${this.count}个${Config.GRADE_NAMES[materialGrade]}
                        </div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">目标产物</div>
                        <div class="summary-value">
                            ${Config.GRADE_NAMES[products[0].grade]}
                        </div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">可能产物</div>
                        <div class="summary-value">
                            ${products.length}种
                        </div>
                    </div>
                </div>
            </div>
        `;

        html += '<div class="products-grid">';
        products.forEach(product => {
            const probability = product.probability.toFixed(2);
            const sourceInfo = product.sourceInfo || '';
            const isCrate = sourceInfo.includes('武器箱');

            let actualWear = 0;
            if (wearResult && wearResult.avgNormalized !== undefined) {
                const productRange = Utils.getIEEE754(product.max - product.min);
                const normalizedRange = Utils.getIEEE754(wearResult.avgNormalized * productRange);
                actualWear = Utils.getIEEE754(product.min + normalizedRange);
                actualWear = Math.max(product.min, Math.min(product.max, actualWear));
            }

            html += `
                <div class="product-card">
                    <div class="product-header">
                        <div class="product-info">
                            <div class="product-name">${product.name}</div>
                            <div class="product-tags">
                                <span class="material-grade-badge grade-${product.grade}">${Config.GRADE_NAMES[product.grade]}</span>
                                ${sourceInfo ? `<span class="source-tag ${isCrate ? 'crate-tag' : 'collection-tag'}">${sourceInfo}</span>` : ''}
                            </div>
                        </div>
                        <div class="product-probability">
                            <div class="probability-value">${probability}%</div>
                        </div>
                    </div>
                    <div class="wear-display">
                        <div class="wear-value">${actualWear.toFixed(16)}</div>
                    </div>
                </div>
            `;
        });
        html += '</div></div>';
        resultsContainer.innerHTML = html;
    }

    static clear() {
        for (let i = 1; i <= this.count; i++) {
            const wearInput = document.getElementById(`materialWear${i}`);
            const materialSelect = document.getElementById(`simpleMaterialSelect${i}`);
            const rangeDisplay = document.getElementById(`simpleMaterialRange${i}`);

            if (wearInput) wearInput.value = '';
            if (materialSelect) materialSelect.value = '';
            if (rangeDisplay) {
                rangeDisplay.textContent = '0.000000-1.000000';
                rangeDisplay.style.color = '';
            }
        }

        document.getElementById('productProbabilityResults').innerHTML = '';
        MaterialManager.currentGrade = null;
        MessageManager.show('简易计算页已清空', 'success');
    }
}

class AutoMaterialCalculator {
    static count = 5;

    static updateTable() {
        const countSelect = document.getElementById('autoMaterialCount');
        const tableBody = document.getElementById('autoMaterialTableBody');
        if (!countSelect || !tableBody) return;

        this.count = parseInt(countSelect.value) || 5;
        tableBody.innerHTML = '';

        for (let i = 1; i <= this.count; i++) {
            const row = document.createElement('tr');
            if (i === this.count) {
                row.innerHTML = `
                    <td>${i}</td>
                    <td>
                        <input type="text" id="autoMaterialWear${i}" class="calculated-value" readonly>
                    </td>
                    <td>
                        <div class="material-search-container">
                            <input type="text" id="autoMaterialSelect${i}" class="material-search-input" placeholder="搜索材料名称" oninput="MaterialSearch.search(${i}, this.value, 'auto')" onfocus="MaterialSearch.showDropdown(${i}, 'auto')" onblur="MaterialSearch.hideDropdown(${i}, 'auto')">
                            <div id="autoMaterialDropdown${i}" class="material-dropdown"></div>
                        </div>
                    </td>
                    <td>
                        <span id="autoMaterialRange${i}" class="range-text">0.000000-1.000000</span>
                    </td>
                    <td>
                        <button class="primary" onclick="AutoMaterialCalculator.copyWear(${i})">复制</button>
                    </td>
                `;
            } else {
                row.innerHTML = `
                    <td>${i}</td>
                    <td>
                        <input type="text" id="autoMaterialWear${i}" placeholder="输入磨损值" oninput="AutoMaterialCalculator.handleMaterialInput(${i}, this)" onfocus="AutoMaterialCalculator.handleMaterialFocus(${i}, this)" onblur="AutoMaterialCalculator.handleMaterialBlur(${i}, this)">
                    </td>
                    <td>
                        <div class="material-search-container">
                            <input type="text" id="autoMaterialSelect${i}" class="material-search-input" placeholder="搜索材料名称" oninput="MaterialSearch.search(${i}, this.value, 'auto')" onfocus="MaterialSearch.showDropdown(${i}, 'auto')" onblur="MaterialSearch.hideDropdown(${i}, 'auto')">
                            <div id="autoMaterialDropdown${i}" class="material-dropdown"></div>
                        </div>
                    </td>
                    <td>
                        <span id="autoMaterialRange${i}" class="range-text">0.000000-1.000000</span>
                    </td>
                    <td>-</td>
                `;
            }
            tableBody.appendChild(row);
        }

        MaterialManager.currentGrade = null;
        this._resetTargetSettings();
        setTimeout(() => this.recalculate(), 100);
        MessageManager.show(`已切换为${this.count}个材料，表格已重建`, 'info');
    }

    static _resetTargetSettings() {
        document.getElementById('autoTargetMin').value = '0.000000';
        document.getElementById('autoTargetMax').value = '0.800000';
        document.getElementById('autoTargetWear').value = '0.070000';
        document.getElementById('targetWearGrade').value = 'factory_new';

        const ieeeDisplay = document.getElementById('autoTargetWearIEEEDisplay');
        const ieeeValue = document.getElementById('autoTargetWearIEEEValue');
        if (ieeeDisplay) ieeeDisplay.style.display = 'none';
        if (ieeeValue) ieeeValue.textContent = '';
    }

    static updateTargetRange() {
        const gradeSelect = document.getElementById('targetWearGrade');
        const targetWearInput = document.getElementById('autoTargetWear');
        const selectedGrade = gradeSelect.value;

        if (selectedGrade !== 'custom') {
            const range = Config.WEAR_GRADE_RANGES[selectedGrade];
            targetWearInput.value = range.target;
            targetWearInput.disabled = true;
            targetWearInput.style.backgroundColor = '#f8f9fa';
        } else {
            targetWearInput.disabled = false;
            targetWearInput.style.backgroundColor = '';
        }

        this.recalculate();
    }

    static handleMaterialInput(index, inputElement) {
        InputValidator.number(inputElement);
        if (inputElement.value.trim()) {
            inputElement.classList.remove('calculated-value');
            inputElement.style.color = '';
            inputElement.style.fontStyle = '';
        }
        this.recalculate();
    }

    static handleMaterialFocus(index, inputElement) {
        if (inputElement.classList.contains('calculated-value')) {
            inputElement.value = '';
            inputElement.classList.remove('calculated-value');
            inputElement.style.color = '';
            inputElement.style.fontStyle = '';
        }
    }

    static handleMaterialBlur(index, inputElement) {
        if (!inputElement.value.trim()) {
            this.recalculate();
        }
    }

    static recalculate() {
        const targetMin = parseFloat(document.getElementById('autoTargetMin').value) || 0.000000;
        const targetMax = parseFloat(document.getElementById('autoTargetMax').value) || 0.800000;
        const targetWear = parseFloat(document.getElementById('autoTargetWear').value) || 0.070000;

        if (targetMin >= targetMax || targetWear < targetMin || targetWear > targetMax) {
            this._showAllAsUncalculable();
            return;
        }

        const userMaterials = [];
        const emptyIndices = [];

        for (let i = 1; i <= this.count; i++) {
            const wearInput = document.getElementById(`autoMaterialWear${i}`);
            if (!wearInput) continue;

            if (wearInput.value.trim() &&
                !wearInput.classList.contains('calculated-value') &&
                wearInput.value !== "无法计算" &&
                wearInput.value !== "超出范围") {

                const wearValue = parseFloat(wearInput.value);
                if (isNaN(wearValue)) continue;

                const materialSelect = document.getElementById(`autoMaterialSelect${i}`);
                let materialMin = 0.000000;
                let materialMax = 1.000000;

                if (materialSelect && materialSelect.value.trim()) {
                    const material = MaterialFinder.findByName(materialSelect.value);
                    if (material) {
                        materialMin = material.min;
                        materialMax = material.max;
                    }
                }

                userMaterials.push({ index: i, wear: wearValue, min: materialMin, max: materialMax });
            } else {
                emptyIndices.push(i);
            }
        }

        if (userMaterials.length === 0) {
            this._showAllAsUncalculable();
            return;
        }

        this._calculateEmptyRows(userMaterials, emptyIndices, targetMin, targetMax, targetWear);
    }

    static _calculateEmptyRows(userMaterials, emptyIndices, targetMin, targetMax, targetWear) {
        let inputNormalizedSum = 0;
        for (const material of userMaterials) {
            const normalized = Utils.getIEEE754((material.wear - material.min) / (material.max - material.min));
            inputNormalizedSum = Utils.getIEEE754(inputNormalizedSum + normalized);
        }

        const targetNormalized = Utils.getIEEE754((targetWear - targetMin) / (targetMax - targetMin));
        const totalNeededNormalized = Utils.getIEEE754(targetNormalized * this.count);
        const remainingNormalizedSum = Utils.getIEEE754(totalNeededNormalized - inputNormalizedSum);
        const normalizedPerMaterial = Utils.getIEEE754(remainingNormalizedSum / emptyIndices.length);

        for (const index of emptyIndices) {
            const wearInput = document.getElementById(`autoMaterialWear${index}`);
            const materialSelect = document.getElementById(`autoMaterialSelect${index}`);

            if (!wearInput) continue;

            let materialMin = 0.000000;
            let materialMax = 1.000000;

            if (materialSelect && materialSelect.value.trim()) {
                const material = MaterialFinder.findByName(materialSelect.value);
                if (material) {
                    materialMin = material.min;
                    materialMax = material.max;
                }
            }

            const recommendedWear = Utils.getIEEE754(materialMin + Utils.getIEEE754(normalizedPerMaterial * (materialMax - materialMin)));

            wearInput.value = recommendedWear.toFixed(16);
            wearInput.classList.add('calculated-value');
            wearInput.style.fontStyle = 'italic';
            wearInput.style.textAlign = 'center';

            if (recommendedWear >= materialMin && recommendedWear <= materialMax) {
                wearInput.style.color = (index === this.count) ? '#28a745' : '#6c757d';
                if (index === this.count) {
                    wearInput.style.fontWeight = 'bold';
                }
            } else {
                wearInput.value = "超出范围";
                wearInput.style.color = '#dc3545';
            }
        }
    }

    static _showAllAsUncalculable() {
        for (let i = 1; i <= this.count; i++) {
            const wearInput = document.getElementById(`autoMaterialWear${i}`);
            if (!wearInput) continue;

            if (wearInput.classList.contains('calculated-value') ||
                !wearInput.value.trim() ||
                wearInput.value === "超出范围") {

                wearInput.value = "无法计算";
                wearInput.classList.add('calculated-value');
                wearInput.style.color = '#dc3545';
                wearInput.style.fontStyle = 'italic';
            }
        }
    }

    static copyWear(index) {
        const wearInput = document.getElementById(`autoMaterialWear${index}`);
        if (wearInput && wearInput.value) {
            wearInput.select();
            document.execCommand('copy');
            MessageManager.show(`材料 ${index} 的磨损值已复制`, 'success');
        }
    }

    static clear() {
        for (let i = 1; i <= this.count; i++) {
            const wearInput = document.getElementById(`autoMaterialWear${i}`);
            const materialSelect = document.getElementById(`autoMaterialSelect${i}`);
            const rangeDisplay = document.getElementById(`autoMaterialRange${i}`);

            if (wearInput) wearInput.value = '';
            if (materialSelect) materialSelect.value = '';
            if (rangeDisplay) {
                rangeDisplay.textContent = '0.000000-1.000000';
                rangeDisplay.style.color = '';
            }
        }

        this._resetTargetSettings();
        MaterialManager.currentGrade = null;
        setTimeout(() => this.recalculate(), 100);
        MessageManager.show('自动配材页已清空', 'success');
    }
}

class IEEE754 {
    static updateDisplay(inputId, valueSpanId, displayDivId) {
        const displayElement = document.getElementById(displayDivId);
        const valueElement = document.getElementById(valueSpanId);
        const inputElement = document.getElementById(inputId);

        if (!displayElement || !valueElement || !inputElement) return;

        const value = inputElement.value.trim();
        if (value === '') {
            displayElement.style.display = 'none';
            return;
        }

        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            displayElement.style.display = 'block';
            valueElement.textContent = '无效数字';
            valueElement.style.color = '#dc3545';
            return;
        }

        const desiredIEEE = Utils.getIEEE754(Number(value));
        displayElement.style.display = 'block';
        valueElement.textContent = desiredIEEE.toString();
        valueElement.style.color = '#495057';
    }

    static updateRange() {
        const desiredFloat = Number(document.getElementById("desiredIEEEInput").value);
        const desiredIEEE = Utils.getIEEE754(desiredFloat);
        document.getElementById("floatIEEEInput").value = desiredIEEE;

        let minIEEE = desiredIEEE;
        while (Utils.getIEEE754(minIEEE - 0.0000000000001) === desiredIEEE) {
            minIEEE -= 0.0000000000001;
        }
        document.getElementById("minIEEEinput").value = minIEEE;

        let maxIEEE = desiredIEEE;
        while (Utils.getIEEE754(maxIEEE + 0.0000000000001) === desiredIEEE) {
            maxIEEE += 0.0000000000001;
        }
        document.getElementById("maxIEEEinput").value = maxIEEE;

        document.getElementById("middleIEEEinput").value = (minIEEE + maxIEEE) / 2;
    }
}

class SearchManager {
    static term = '';
    static currentIndex = -1;
    static results = [];

    static perform() {
        const searchInput = document.getElementById('searchInput');
        this.term = searchInput.value.trim();

        if (!this.term) {
            MessageManager.show('请输入搜索内容', 'error');
            document.querySelectorAll('.search-highlight').forEach(el => {
                el.classList.remove('search-highlight');
            });
            document.getElementById('searchStatus').textContent = '未搜索';
            return;
        }

        const results = document.querySelectorAll('.real-time-result');
        this.results = [];

        results.forEach((result, index) => {
            if (result.textContent.toLowerCase().includes(this.term.toLowerCase())) {
                this.results.push(index);
            }
        });

        const searchStatus = document.getElementById('searchStatus');
        if (this.results.length === 0) {
            searchStatus.textContent = `未找到包含 "${this.term}" 的结果`;
            searchStatus.style.color = '#dc3545';
            this.currentIndex = -1;
            document.querySelectorAll('.search-highlight').forEach(el => {
                el.classList.remove('search-highlight');
            });
        } else {
            searchStatus.textContent = `找到 ${this.results.length} 个结果`;
            searchStatus.style.color = '#28a745';
            this.currentIndex = 0;
            this._highlightCurrent();
        }
    }

    static prev() {
        if (this.results.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.results.length) % this.results.length;
        this._highlightCurrent();
    }

    static next() {
        if (this.results.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.results.length;
        this._highlightCurrent();
    }

    static _highlightCurrent() {
        document.querySelectorAll('.search-highlight').forEach(el => {
            el.classList.remove('search-highlight');
        });

        if (this.currentIndex >= 0 && this.currentIndex < this.results.length) {
            const results = document.querySelectorAll('.real-time-result');
            const currentResult = results[this.results[this.currentIndex]];

            currentResult.classList.add('search-highlight');
            currentResult.scrollIntoView({ behavior: 'smooth', block: 'center' });

            document.getElementById('searchStatus').textContent =
                `找到 ${this.results.length} 个结果 (${this.currentIndex + 1}/${this.results.length})`;
        }
    }
}

class ItemQuery {
    static search(keyword) {
        const dropdown = document.getElementById('ieeeSearchDropdown');
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';

        if (!keyword || keyword.trim() === '') return;

        let results = [];
        const searchTerm = keyword.toLowerCase().trim();

        for (const [id, item] of Object.entries(materialDatabase)) {
            if (item.name.toLowerCase().includes(searchTerm)) {
                results.push({ id, ...item });
            }
        }

        if (results.length === 0) return;

        let html = '';
        results.slice(0, 8).forEach(item => {
            const gradeText = MaterialFinder.getGradeChineseName(item.grade);
            const gradeClass = `grade-${item.grade}`;

            html += `
                <div class="material-dropdown-item" onclick="ItemQuery.select('${item.id}')"
                     onmouseover="this.classList.add('selected')" 
                     onmouseout="this.classList.remove('selected')">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 500; margin-bottom: 4px;">${item.name}</div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="material-grade-badge ${gradeClass}" style="font-size: 10px; padding: 2px 6px;">${gradeText}</span>
                                <span style="font-size: 11px; color: #6c757d;">${item.min.toFixed(6)}-${item.max.toFixed(6)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        dropdown.innerHTML = html;
        dropdown.style.display = 'block';
    }

    static select(itemId) {
        const item = materialDatabase[itemId];
        if (!item) return;

        document.getElementById('ieeeSearchInput').value = item.name;
        const resultDiv = document.getElementById('ieeeResult');
        resultDiv.style.display = 'block';

        document.getElementById('resultName').textContent = item.name;
        document.getElementById('resultRange').textContent = `${item.min.toFixed(6)} - ${item.max.toFixed(6)}`;
        document.getElementById('resultMin').textContent = item.min.toFixed(6);
        document.getElementById('resultMax').textContent = item.max.toFixed(6);

        const gradeText = MaterialFinder.getGradeChineseName(item.grade);
        const gradeClass = `grade-${item.grade}`;

        const resultNameElem = document.getElementById('resultName');
        resultNameElem.innerHTML = `
            ${item.name}
            <span class="material-grade-badge ${gradeClass}" style="margin-left: 10px; font-size: 12px; padding: 4px 10px;">
                ${gradeText}
            </span>
        `;

        this._displaySources(item);
        document.getElementById('ieeeSearchDropdown').style.display = 'none';
    }

    static _displaySources(item) {
        const collectionsSection = document.getElementById('resultCollectionsSection');
        const collectionsDiv = document.getElementById('resultCollections');
        const cratesSection = document.getElementById('resultCratesSection');
        const cratesDiv = document.getElementById('resultCrates');
        const otherSection = document.getElementById('resultOtherSources');
        const otherDiv = document.getElementById('resultOther');

        if (item.collections && item.collections.length > 0) {
            collectionsSection.style.display = 'block';
            collectionsDiv.innerHTML = item.collections.map(collection =>
                `<span class="source-tag collection-tag">${collection}</span>`
            ).join(' ');
        } else {
            collectionsSection.style.display = 'none';
        }

        if (item.crates && item.crates.length > 0) {
            cratesSection.style.display = 'block';
            cratesDiv.innerHTML = item.crates.map(crate =>
                `<span class="source-tag crate-tag">${crate}</span>`
            ).join(' ');
        } else {
            cratesSection.style.display = 'none';
        }

        let otherSources = [];
        if (item.source && item.source.length > 0) otherSources = otherSources.concat(item.source);
        if (item.containers && item.containers.length > 0) otherSources = otherSources.concat(item.containers);
        if (item.origin && item.origin.length > 0) otherSources = otherSources.concat(item.origin);
        if (item.from && item.from.length > 0) otherSources = otherSources.concat(item.from);

        const otherFields = ['case', 'container', 'drop', 'obtain', 'acquire'];
        otherFields.forEach(field => {
            if (item[field] && item[field].length > 0) {
                otherSources = otherSources.concat(item[field]);
            }
        });

        if (otherSources.length > 0) {
            otherSection.style.display = 'block';
            otherDiv.innerHTML = otherSources.map(source =>
                `<span class="source-tag other-tag">${source}</span>`
            ).join(' ');
        } else {
            otherSection.style.display = 'none';
        }

        if (!item.collections && !item.crates && otherSources.length === 0) {
            collectionsSection.style.display = 'block';
            collectionsDiv.innerHTML = '<span style="color: #94a3b8; font-style: italic;">无来源信息</span>';
        }
    }

    static showDropdown() {
        const input = document.getElementById('ieeeSearchInput');
        if (input.value) this.search(input.value);
    }

    static hideDropdown() {
        setTimeout(() => {
            document.getElementById('ieeeSearchDropdown').style.display = 'none';
        }, 200);
    }
}

class UIEventHandler {
    static setupDropdownPositioning() {
        document.addEventListener('click', function (e) {
            const input = e.target;
            if (input.classList.contains('material-search-input')) {
                setTimeout(() => {
                    const dropdown = input.nextElementSibling;
                    if (dropdown && dropdown.classList.contains('material-dropdown')) {
                        const rect = input.getBoundingClientRect();
                        dropdown.style.left = `${rect.left}px`;
                        dropdown.style.top = `${rect.bottom + window.scrollY}px`;
                        dropdown.style.width = `${rect.width}px`;
                    }
                }, 50);
            }
        });
    }
}

class AppInitializer {
    static init() {
        MaterialManager.init();
        SimpleWearCalculator.updateTable();
        AutoMaterialCalculator.updateTable();
        IEEE754.updateRange();
        UIEventHandler.setupDropdownPositioning();

        setTimeout(() => {
            MaterialManager.filterByRule();
            const targetWearInput = document.getElementById('autoTargetWear');
            const gradeSelect = document.getElementById('targetWearGrade');
            if (targetWearInput && gradeSelect && gradeSelect.value !== 'custom') {
                targetWearInput.disabled = true;
                targetWearInput.style.backgroundColor = '#f8f9fa';
            }

            const inputElement = document.getElementById('fcCdesiredfloatinput');
            if (inputElement && inputElement.value.trim()) {
                IEEE754.updateDisplay('fcCdesiredfloatinput', 'targetWearIEEEValue', 'targetWearIEEEDisplay');
            }

            const ieeeDisplays = document.querySelectorAll('.ieee754-display');
            ieeeDisplays.forEach(display => {
                display.style.display = 'none';
            });

            CombinationCalculator.updatePreview();
        }, 100);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    AppInitializer.init();
});