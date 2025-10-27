let MATERIAL_COUNT = 5;
let MATERIAL_TYPE_COUNT = 1;
let materialData = {};
let calculationStartTime = 0;
let calculationStats = {
    total: 0,
    processed: 0,
    found: 0
};
let searchTerm = '';
let currentSearchIndex = -1;
let searchResults = [];

const DEFAULT_VALUES = {
    MIN_WEAR: '0.00',
    MAX_WEAR: '0.80',
    SPECIFICITY: '0.00000001'
};

const Utils = {
    getIEEE754: function (x) {
        var float = new Float32Array(1);
        float[0] = x;
        return float[0];
    },

    combinations: function (n, k) {
        if (k > n) return 0;
        if (k === 0 || k === n) return 1;

        k = Math.min(k, n - k);
        let result = 1;
        for (let i = 1; i <= k; i++) {
            result = result * (n - k + i) / i;
        }
        return Math.round(result);
    }
};

function showMessage(message, type = 'info') {
    const toast = document.getElementById('messageToast');
    toast.textContent = message;
    toast.className = 'message-toast';
    toast.classList.add(type);
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function setLoadingState(loading) {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (!btn.classList.contains('tabButton')) {
            btn.disabled = loading;
        }
    });

    if (loading) {
        document.body.classList.add('loading');
    } else {
        document.body.classList.remove('loading');
    }
}

function updateStats() {
    document.getElementById('totalCombinations').textContent = calculationStats.total.toLocaleString();
    document.getElementById('processedCombinations').textContent = calculationStats.processed.toLocaleString();
    document.getElementById('foundResults').textContent = calculationStats.found.toLocaleString();

    if (calculationStartTime > 0) {
        const elapsed = Math.round((Date.now() - calculationStartTime) / 1000);
        document.getElementById('timeElapsed').textContent = `${elapsed}s`;
    }
}

function initSearch() {
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.style.cssText = `
                margin: 15px 0;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #dee2e6;
            `;

    searchContainer.innerHTML = `
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <input type="text" id="searchInput" placeholder="在结果中搜索..." 
                           style="flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px;">
                    <button onclick="performSearch()" class="primary" style="padding: 8px 16px;">搜索</button>
                    <button onclick="prevSearch()" class="secondary" style="padding: 8px 12px;">上一个</button>
                    <button onclick="nextSearch()" class="secondary" style="padding: 8px 12px;">下一个</button>
                    <span id="searchStatus" style="color: #666; font-size: 14px;">未搜索</span>
                </div>
            `;

    const combinationsText = document.getElementById("fcCombinationsText");
    combinationsText.parentNode.insertBefore(searchContainer, combinationsText);
    document.getElementById('searchInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

function performSearch() {
    const searchInput = document.getElementById('searchInput');
    searchTerm = searchInput.value.trim();

    if (!searchTerm) {
        showMessage('请输入搜索内容', 'error');
        document.querySelectorAll('.search-highlight').forEach(el => {
            el.classList.remove('search-highlight');
        });
        document.getElementById('searchStatus').textContent = '未搜索';
        return;
    }

    const results = document.querySelectorAll('.real-time-result');
    searchResults = [];

    results.forEach((result, index) => {
        if (result.textContent.toLowerCase().includes(searchTerm.toLowerCase())) {
            searchResults.push(index);
        }
    });

    const searchStatus = document.getElementById('searchStatus');
    if (searchResults.length === 0) {
        searchStatus.textContent = `未找到包含 "${searchTerm}" 的结果`;
        searchStatus.style.color = '#dc3545';
        currentSearchIndex = -1;
        document.querySelectorAll('.search-highlight').forEach(el => {
            el.classList.remove('search-highlight');
        });
    } else {
        searchStatus.textContent = `找到 ${searchResults.length} 个结果`;
        searchStatus.style.color = '#28a745';
        currentSearchIndex = 0;
        highlightCurrentSearch();
    }
}

function prevSearch() {
    if (searchResults.length === 0) return;

    currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    highlightCurrentSearch();
}

function nextSearch() {
    if (searchResults.length === 0) return;

    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    highlightCurrentSearch();
}

function highlightCurrentSearch() {
    document.querySelectorAll('.search-highlight').forEach(el => {
        el.classList.remove('search-highlight');
    });

    if (currentSearchIndex >= 0 && currentSearchIndex < searchResults.length) {
        const results = document.querySelectorAll('.real-time-result');
        const currentResult = results[searchResults[currentSearchIndex]];

        currentResult.classList.add('search-highlight');

        currentResult.scrollIntoView({ behavior: 'smooth', block: 'center' });

        document.getElementById('searchStatus').textContent =
            `找到 ${searchResults.length} 个结果 (${currentSearchIndex + 1}/${searchResults.length})`;
    }
}

let batchResults = [];
const BATCH_SIZE = 1000;

function addToBatch(wear, materialsText, isExactMatch) {
    const wearClass = isExactMatch ? 'exact-match-highlight' : 'normal-wear';

    batchResults.push(`
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

    if (batchResults.length >= BATCH_SIZE) {
        flushBatch();
    }
}

function flushBatch() {
    if (batchResults.length === 0) return;

    const combinationstext = document.getElementById("fcCombinationsText");

    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = batchResults.join('');

    while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
    }

    combinationstext.appendChild(fragment);
    combinationstext.scrollTop = combinationstext.scrollHeight;

    batchResults = [];
}

function initMaterialTypes() {
    for (let i = 1; i <= 5; i++) {
        if (!materialData[i]) {
            materialData[i] = {
                input: '',
                output: '',
                cumulative: '',
                minWear: DEFAULT_VALUES.MIN_WEAR,
                maxWear: DEFAULT_VALUES.MAX_WEAR
            };
        }
    }

    const selectElement = document.getElementById('materialTypeCountSelect');
    if (selectElement) {
        selectElement.value = '1';
        MATERIAL_TYPE_COUNT = 1;
    }
}

function saveMaterialData(index) {
    if (materialData[index]) {
        materialData[index].input = document.getElementById(`fcAltInput${index}`)?.value || '';
        materialData[index].output = document.getElementById(`fcOutput${index}`)?.value || '';
        materialData[index].cumulative = document.getElementById(`fcCumulative${index}`)?.value || '';
        materialData[index].minWear = document.getElementById(`materialMinWear${index}`)?.value || DEFAULT_VALUES.MIN_WEAR;
        materialData[index].maxWear = document.getElementById(`materialMaxWear${index}`)?.value || DEFAULT_VALUES.MAX_WEAR;
    }
}

function restoreMaterialData(index) {
    if (materialData[index]) {
        const inputElem = document.getElementById(`fcAltInput${index}`);
        const outputElem = document.getElementById(`fcOutput${index}`);
        const cumulativeElem = document.getElementById(`fcCumulative${index}`);
        const minWearElem = document.getElementById(`materialMinWear${index}`);
        const maxWearElem = document.getElementById(`materialMaxWear${index}`);

        if (inputElem) inputElem.value = materialData[index].input;
        if (outputElem) outputElem.value = materialData[index].output;
        if (cumulativeElem) cumulativeElem.value = materialData[index].cumulative;
        if (minWearElem) minWearElem.value = materialData[index].minWear;
        if (maxWearElem) maxWearElem.value = materialData[index].maxWear;
    }
}

function updateMaterialCount() {
    MATERIAL_COUNT = parseInt(document.getElementById('materialCountSelect').value);
    console.log("材料数量已更新为:", MATERIAL_COUNT);
    fcUpdateCombinations();
}

function updateMaterialTypeCount() {
    const newCount = parseInt(document.getElementById('materialTypeCountSelect').value);

    for (let i = 1; i <= MATERIAL_TYPE_COUNT; i++) {
        saveMaterialData(i);
    }

    MATERIAL_TYPE_COUNT = newCount;
    const containers = document.getElementById('materialTypeContainers');
    containers.innerHTML = '';

    for (let i = 1; i <= newCount; i++) {
        createMaterialTypeContainer(i);
    }
}

function createMaterialTypeContainer(index) {
    const containers = document.getElementById('materialTypeContainers');

    const container = document.createElement('div');
    container.className = 'material-type-container';
    container.id = `materialType${index}`;
    container.innerHTML = `
                <div class="material-type-header">
                    <div class="material-type-color material-type-${index}"></div>
                    <h4>材料种类 ${index}</h4>
                </div>
                <textarea id="fcAltInput${index}" class="material-type-textarea" placeholder="输入材料种类 ${index} 的磨损数据..."></textarea>
                <div class="material-type-buttons">
                    <button class="primary" onclick="extractAndShowFloats(${index})">提取数据</button>
                </div>
                <textarea id="fcOutput${index}" class="material-type-output" readonly placeholder="提取的材料数据将显示在这里"></textarea>
                <textarea id="fcCumulative${index}" class="material-type-output" readonly placeholder="累计的材料数据将显示在这里"></textarea>
                <div class="material-type-buttons">
                    <button class="secondary" onclick="copyResults(${index})">复制数据</button>
                    <button class="primary" onclick="mergeToTotalInput(${index})">汇总数据</button>
                    <button class="secondary" onclick="clearMaterialType(${index})">清除数据</button>
                </div>
                <div class="material-wear-range">
                    <div>
                        <h4>材料最小磨损</h4>
                        <input id="materialMinWear${index}" value="${DEFAULT_VALUES.MIN_WEAR}" placeholder="最小磨损" />
                    </div>
                    <div>
                        <h4>材料最大磨损</h4>
                        <input id="materialMaxWear${index}" value="${DEFAULT_VALUES.MAX_WEAR}" placeholder="最大磨损" />
                    </div>
                </div>
            `;
    containers.appendChild(container);
    restoreMaterialData(index);
}

function normalizeMaterialWear(wearValue, materialTypeIndex) {
    const materialMinWear = Utils.getIEEE754(Number(document.getElementById(`materialMinWear${materialTypeIndex}`).value) || 0.00);
    const materialMaxWear = Utils.getIEEE754(Number(document.getElementById(`materialMaxWear${materialTypeIndex}`).value) || 0.80);

    const normalized = Utils.getIEEE754((wearValue - materialMinWear) / (materialMaxWear - materialMinWear));
    return normalized;
}

function mergeToTotalInput(materialTypeIndex) {
    const cumulativeResults = document.getElementById(`fcCumulative${materialTypeIndex}`).value;
    const totalInput = document.getElementById("fcAltInput");

    if (!cumulativeResults) {
        showMessage(`材料种类 ${materialTypeIndex} 没有数据可汇总`, 'error');
        return;
    }

    const markedData = cumulativeResults.split(',').map(item => {
        const trimmed = item.trim();
        return trimmed ? `${trimmed}|${materialTypeIndex}` : '';
    }).filter(item => item).join(', ');

    const currentTotalData = totalInput.value.split(',').map(item => {
        const parts = item.trim().split('|');
        return parts[0];
    }).filter(item => item);

    const cumulativeArray = cumulativeResults.split(',').map(item => item.trim()).filter(item => item);
    const existingSet = new Set(currentTotalData);
    const newData = cumulativeArray.filter(item => !existingSet.has(item));

    if (newData.length === 0) {
        showMessage(`材料种类 ${materialTypeIndex} 的数据已经全部汇总过了`, 'info');
        return;
    }

    const newMarkedData = newData.map(item => `${item}|${materialTypeIndex}`).join(', ');

    if (totalInput.value) {
        totalInput.value += ", " + newMarkedData;
    } else {
        totalInput.value = newMarkedData;
    }

    showMessage(`材料种类 ${materialTypeIndex} 的 ${newData.length} 条新数据已汇总到总数据中`, 'success');
}

function validateInputs() {
    const maxWear = parseFloat(document.getElementById('fcCmaxwearinput').value);
    const minWear = parseFloat(document.getElementById('fcCminwearinput').value);
    const desiredFloat = parseFloat(document.getElementById('fcCdesiredfloatinput').value);
    const specificity = parseFloat(document.getElementById('fcCspecificityinput').value);

    if (isNaN(maxWear) || isNaN(minWear) || isNaN(desiredFloat) || isNaN(specificity)) {
        showMessage('请输入有效的数值', 'error');
        return false;
    }

    if (minWear >= maxWear) {
        showMessage('最小磨损必须小于最大磨损', 'error');
        return false;
    }

    if (specificity === 0 && isNaN(desiredFloat)) {
        showMessage('精确度为0时，必须输入有效的目标磨损值', 'error');
        return false;
    }

    return true;
}

async function fcGetCombinations(arr, originalArr, materialTypes) {
    batchResults = [];

    const combinationstext = document.getElementById("fcCombinationsText");
    const progress_bar = document.getElementById("fcProgressBar");
    const total_combos = Utils.combinations(arr.length, MATERIAL_COUNT);
    const max_wear = Utils.getIEEE754(Number(document.getElementById('fcCmaxwearinput').value));
    const min_wear = Utils.getIEEE754(Number(document.getElementById('fcCminwearinput').value));
    const desired_ieee = Utils.getIEEE754(Number(document.getElementById('fcCdesiredfloatinput').value));
    const desired_float = Number(document.getElementById('fcCdesiredfloatinput').value);
    const specificity = Number(document.getElementById('fcCspecificityinput').value);

    calculationStats.total = total_combos;
    calculationStats.processed = 0;
    calculationStats.found = 0;
    updateStats();

    let progress = 0;
    let bestWear = 1000;
    let lastUpdateTime = Date.now();

    const rows = [];
    const positions = [];

    for (let i = 0; i < MATERIAL_COUNT; i++) {
        const copy = arr.slice(0);
        rows.push(copy);
        positions.push(i);
    }

    let done = false;
    const updateFrequency = MATERIAL_COUNT === 10 ? 1000000 : 50000;
    while (!done) {
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
            if (combo[i] === undefined) {
                undefinedCount++;
            }
        }
        if (undefinedCount >= MATERIAL_COUNT) {
            done = true;
        }

        if (combo.indexOf(undefined) < 0) {
            let normalizedSum = 0;
            for (let i = 0; i < MATERIAL_COUNT; i++) {
                normalizedSum = Utils.getIEEE754(normalizedSum + combo[i]);
            }

            let avgNormalized = Utils.getIEEE754(normalizedSum / Utils.getIEEE754(MATERIAL_COUNT));
            let wear = Utils.getIEEE754(min_wear + Utils.getIEEE754(avgNormalized * Utils.getIEEE754(max_wear - min_wear)));

            const isExactMatch = (specificity === 0 && wear == desired_ieee) ||
                (specificity === 0 && truncateDecimals(wear, countDecimals(desired_float)) == desired_float) ||
                (wear == desired_ieee);

            if (isExactMatch || (wear >= desired_ieee && wear <= (Number(desired_ieee) + Number(specificity)))) {
                const materialsText = originalCombo.map((val, index) => {
                    const typeIndex = materialTypeCombo[index];
                    return `<span class="text-material-type-${typeIndex}">${Utils.getIEEE754(val)}</span>`;
                }).join(' + ');

                addToBatch(wear, materialsText, isExactMatch);
                calculationStats.found++;

                if (wear < bestWear) {
                    bestWear = wear;
                }
            }

            progress++;
            calculationStats.processed = progress;
        }

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

        const currentTime = Date.now();
        if (currentTime - lastUpdateTime > 100 || progress % updateFrequency === 0) {
            const percent_done = ((progress / total_combos) * 100).toFixed(2);
            progress_bar.style.width = percent_done + '%';
            updateStats();
            lastUpdateTime = currentTime;

            flushBatch();

            if (progress % updateFrequency === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        if (progress >= total_combos) {
            done = true;
        }
    }

    flushBatch();
    progress_bar.style.width = '100%';
    setLoadingState(false);
    updateStats();

    if (calculationStats.found === 0) {
        combinationstext.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">未找到符合条件的组合</div>';
    } else {
        showMessage(`计算完成! 共找到 ${calculationStats.found.toLocaleString()} 个结果`, 'success');
    }
}

function fcCombinations() {
    setLoadingState(false);
    batchResults = [];
    calculationStats = {
        total: 0,
        processed: 0,
        found: 0
    };
    const combinationstext = document.getElementById("fcCombinationsText");
    combinationstext.innerHTML = '';
    
    const progressBar = document.getElementById("fcProgressBar");
    progressBar.style.width = '0%';
    updateStats();
    setTimeout(() => {
        if (!validateInputs()) return;
        
        calculationStartTime = Date.now();
        setLoadingState(true);
    if (!validateInputs()) return;

    calculationStartTime = Date.now();
    setLoadingState(true);

    const progressBar = document.getElementById("fcProgressBar");  
    const fcTotalCombosText = document.getElementById("fcTotalCombosText");  
    progressBar.style.width = '0%';

    const altFloats = document.getElementById("fcAltInput").value;

    let originalFloatList = [];
    let floatList = [];
    let materialTypeList = [];

    if (altFloats && altFloats.trim() !== '') {
        altFloats.split(',').forEach(item => {
            const parts = item.trim().split('|');
            const current = parseFloat(parts[0]);
            const materialType = parts[1] ? parseInt(parts[1]) : 1;

            if (!isNaN(current) && current % 1 !== 0) {
                originalFloatList.push(current);
                floatList.push(normalizeMaterialWear(current, materialType));
                materialTypeList.push(materialType);
            }
        });
    } else {
        showMessage('请先在数据处理框中输入材料数据！', 'error');
        setLoadingState(false);
        return;
    }

    if (floatList.length >= MATERIAL_COUNT) {
        const totalCombos = Utils.combinations(floatList.length, MATERIAL_COUNT);
        fcTotalCombosText.textContent = `可能有这么多结果: ${totalCombos} (实际材料数: ${floatList.length})`;

        fcGetCombinations(floatList, originalFloatList, materialTypeList);
    } else {
        showMessage(`最少需要输入${MATERIAL_COUNT}个材料，或者哪里搞错咯?`, 'error');
        setLoadingState(false);
    }
 }, 0);
}

function fcUpdateCombinations() {
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

    if (float_list.length >= MATERIAL_COUNT) {
        const total_combos = Utils.combinations(float_list.length, MATERIAL_COUNT);
        totalcombostext.innerHTML = "可能有这么多结果: " + total_combos;
    } else {
        totalcombostext.innerHTML = "等待计算...";
    }
}

function extractFloats(input) {
    const regex = /\b0\.\d{4,}\b/g;
    const matches = input.match(regex);
    return matches ? matches.join(", ") : null;
}

function extractAndShowFloats(materialTypeIndex) {
    const inputText = document.getElementById(`fcAltInput${materialTypeIndex}`).value;
    const outputText = document.getElementById(`fcOutput${materialTypeIndex}`);
    const cumulativeResults = document.getElementById(`fcCumulative${materialTypeIndex}`);

    const extractedFloats = extractFloats(inputText);
    if (!extractedFloats) {
        showMessage('未找到有效的磨损数据', 'error');
        return;
    }

    outputText.value = extractedFloats;

    if (cumulativeResults.value) {
        cumulativeResults.value += ", " + extractedFloats;
    } else {
        cumulativeResults.value = extractedFloats;
    }

    document.getElementById(`fcAltInput${materialTypeIndex}`).value = "";

    saveMaterialData(materialTypeIndex);
    showMessage(`材料种类 ${materialTypeIndex} 数据提取成功`, 'success');
}

function copyResults(materialTypeIndex) {
    const cumulativeResults = document.getElementById(`fcCumulative${materialTypeIndex}`);
    cumulativeResults.select();
    cumulativeResults.setSelectionRange(0, 99999);
    document.execCommand("copy");
    showMessage(`材料种类 ${materialTypeIndex} 数据已复制`, 'success');
}

function clearMaterialType(materialTypeIndex) {
    document.getElementById(`fcAltInput${materialTypeIndex}`).value = "";
    document.getElementById(`fcOutput${materialTypeIndex}`).value = "";
    document.getElementById(`fcCumulative${materialTypeIndex}`).value = "";

    saveMaterialData(materialTypeIndex);
    showMessage(`材料种类 ${materialTypeIndex} 数据已清除`, 'info');
}

function clearAllMaterialTypes() {
    for (let i = 1; i <= MATERIAL_TYPE_COUNT; i++) {
        document.getElementById(`fcAltInput${i}`).value = "";
        document.getElementById(`fcOutput${i}`).value = "";
        document.getElementById(`fcCumulative${i}`).value = "";
        saveMaterialData(i);
    }
    document.getElementById("fcAltInput").value = "";
    document.getElementById("fcTotalCombosText").textContent = "等待计算...";
    document.getElementById("fcCombinationsText").innerHTML = "";
    document.getElementById("fcProgressBar").style.width = '0%';
    calculationStats.total = 0;
    calculationStats.processed = 0;
    calculationStats.found = 0;
    updateStats();
    showMessage('所有材料数据已清除', 'info');
}

function updateIeeeRange() {
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

function openTab(tabName) {
    var i, tabcontent, tabbutton;
    tabcontent = document.getElementsByClassName("tabcontent");
    tabbutton = document.getElementsByClassName("tabButton");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
        tabbutton[i].classList.remove('active');
    }
    document.getElementById(tabName).style.display = "block";
    event.currentTarget.classList.add('active');
}

truncateDecimals = function (number, digits) {
    var multiplier = Math.pow(10, digits),
        adjustedNum = number * multiplier,
        truncatedNum = Math[adjustedNum < 0 ? 'ceil' : 'floor'](adjustedNum);
    return truncatedNum / multiplier;
};

var countDecimals = function (value) {
    if (Math.floor(value) === value) return 0;
    return value.toString().split(".")[1].length || 0;
}

document.addEventListener('DOMContentLoaded', function () {
    initMaterialTypes();
});