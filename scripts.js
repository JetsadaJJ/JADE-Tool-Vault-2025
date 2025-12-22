document.addEventListener('DOMContentLoaded', () => {
    // === 1. การตั้งค่าความปลอดภัย (PIN) ===
    const ADMIN_PIN = "271046"; 

    if (typeof db === 'undefined') {
        console.error("Firebase db is not initialized. Please check your index.html configuration.");
        return;
    }

    // 2. กำหนดตัวแปรสำหรับองค์ประกอบหลัก
    const toolList = document.getElementById('tool-list');
    const addToolForm = document.getElementById('addToolForm');
    const searchInput = document.getElementById('searchInput');
    const categoryContainer = document.querySelector('.categories'); 
    const toolCategorySelect = document.getElementById('toolCategory'); 
    
    const statusButtons = document.querySelectorAll('.status-filters button');
    const resultCountDisplay = document.createElement('h4');
    resultCountDisplay.id = 'resultCountDisplay';
    resultCountDisplay.style.margin = '20px auto';
    toolList.parentNode.insertBefore(resultCountDisplay, toolList); 
    
    const fabButton = document.getElementById('fabButton');
    const addToolModal = document.getElementById('addToolModal');
    const closeButton = addToolModal ? addToolModal.querySelector('.close-button') : null;
    const modalTitle = addToolModal.querySelector('h2'); 
    
    const documentIdField = document.getElementById('documentId');
    const clearSearchButton = document.getElementById('clearSearchButton');
    
    const categoryModal = document.getElementById('categoryModal');
    const closeCategoryModal = document.getElementById('closeCategoryModal');
    const categoryForm = document.getElementById('categoryForm');
    const currentCategoryList = document.getElementById('currentCategoryList');
    const categorySubmitButton = document.getElementById('categorySubmitButton');
    
    const categoryIdField = document.getElementById('categoryId');
    const categoryNameInput = document.getElementById('categoryName');
    const categoryIDInput = document.getElementById('categoryIDInput');
    const categoryOrderInput = document.getElementById('categoryOrder');

    let currentFilter = 'all'; 
    let currentStatusFilter = 'all'; 
    let allTools = []; 
    let availableCategories = []; 

    // --- ส่วนที่ 0: ระบบความปลอดภัย ---
    const checkPinAndExecute = (action, onSuccess) => {
        const pin = prompt(`กรุณาใส่ PIN Code เพื่อ${action}:`);
        if (pin === ADMIN_PIN) {
            onSuccess();
        } else {
            alert("PIN Code ไม่ถูกต้อง!");
        }
    };

    // --- ส่วนที่ 1: จัดการ Tool Modal (เปิด/ปิด) ---
    if (fabButton && addToolModal) {
        fabButton.addEventListener('click', () => {
            checkPinAndExecute('เพิ่มเครื่องมือ', () => {
                modalTitle.textContent = '+ เพิ่มเครื่องมือใหม่';
                documentIdField.value = ''; 
                addToolForm.reset(); 
                addToolModal.style.display = 'block';
            });
        });

        if (closeButton) {
            closeButton.onclick = () => addToolModal.style.display = 'none';
        }
    }

    // --- ส่วนที่ 2: บันทึกข้อมูลเครื่องมือ (แก้ปัญหาหน้าเว็บ Refresh) ---
    if (addToolForm) {
        addToolForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // *** สำคัญ: ป้องกันหน้าเว็บรีเฟรช ***

            const toolData = {
                name: document.getElementById('toolName').value.trim(),
                description: document.getElementById('toolDesc').value.trim(),
                link: document.getElementById('toolLink').value.trim(),
                category: document.getElementById('toolCategory').value,
                status: document.getElementById('toolStatus').value,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            checkPinAndExecute(documentIdField.value ? 'อัปเดตเครื่องมือ' : 'บันทึกเครื่องมือ', async () => {
                try {
                    const docId = documentIdField.value;
                    if (docId) {
                        // โหมดแก้ไข
                        await db.collection("tools").doc(docId).update(toolData);
                        alert("อัปเดตเครื่องมือสำเร็จ!");
                    } else {
                        // โหมดเพิ่มใหม่
                        await db.collection("tools").add(toolData);
                        alert("บันทึกเครื่องมือสำเร็จ!");
                    }
                    addToolModal.style.display = 'none';
                    addToolForm.reset();
                } catch (error) {
                    console.error("Error saving tool: ", error);
                    alert("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล");
                }
            });
        });
    }

    // --- ส่วนที่ 3: จัดการหมวดหมู่ (CRUD Category) ---
    const renderCategoryButtons = () => {
        categoryContainer.innerHTML = '';
        const allBtn = document.createElement('button');
        allBtn.textContent = 'ทั้งหมด';
        allBtn.className = currentFilter === 'all' ? 'active' : '';
        allBtn.onclick = () => setFilter('all');
        categoryContainer.appendChild(allBtn);

        availableCategories.forEach(cat => {
            const btn = document.createElement('button');
            btn.textContent = cat.name;
            btn.className = currentFilter === cat.id ? 'active' : '';
            btn.onclick = () => setFilter(cat.id);
            categoryContainer.appendChild(btn);
        });

        const manageBtn = document.createElement('button');
        manageBtn.innerHTML = '⚙️';
        manageBtn.className = 'category-icon-button';
        manageBtn.onclick = () => checkPinAndExecute('จัดการหมวดหมู่', () => {
            renderCategoryAdminList();
            categoryModal.style.display = 'block';
        });
        categoryContainer.appendChild(manageBtn);
    };

    const setFilter = (id) => {
        currentFilter = id;
        renderCategoryButtons();
        filterAndSearch(searchInput.value, currentFilter, currentStatusFilter);
    };

    const renderCategoryAdminList = () => {
        currentCategoryList.innerHTML = '';
        availableCategories.forEach(cat => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${cat.name} (ID: ${cat.id})</span>
                <div class="category-admin-actions">
                    <button class="btn-edit-cat" onclick="editCategory('${cat.id}', '${cat.name}', ${cat.order})">แก้ไข</button>
                    <button class="btn-delete-cat" onclick="deleteCategory('${cat.id}', '${cat.name}')">ลบ</button>
                </div>
            `;
            currentCategoryList.appendChild(li);
        });
    };

    if (categoryForm) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = categoryIdField.value || categoryIDInput.value.toLowerCase().trim();
            const data = {
                name: categoryNameInput.value.trim(),
                order: parseInt(categoryOrderInput.value),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            checkPinAndExecute('บันทึกหมวดหมู่', async () => {
                try {
                    await db.collection("categories").doc(id).set(data, { merge: true });
                    alert("บันทึกหมวดหมู่สำเร็จ!");
                    categoryForm.reset();
                    categoryIdField.value = '';
                    categoryIDInput.disabled = false;
                    categoryModal.style.display = 'none';
                } catch (e) { alert("เกิดข้อผิดพลาดในการบันทึกหมวดหมู่"); }
            });
        });
    }

    // --- ส่วนที่ 4: การโหลดข้อมูล Real-time ---
    const loadCategories = () => {
        db.collection("categories").orderBy("order", "asc").onSnapshot(snap => {
            availableCategories = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCategoryButtons();
            
            toolCategorySelect.innerHTML = '<option value="" disabled selected>เลือกหมวดหมู่</option>';
            availableCategories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                toolCategorySelect.appendChild(opt);
            });
            loadTools();
        });
    };

    const loadTools = () => {
        db.collection("tools").orderBy("timestamp", "desc").onSnapshot(snap => {
            allTools = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            filterAndSearch(searchInput.value, currentFilter, currentStatusFilter);
        });
    };

    const filterAndSearch = (term, cat, stat) => {
        toolList.innerHTML = '';
        let count = 0;
        allTools.forEach(tool => {
            const matchSearch = tool.name.toLowerCase().includes(term.toLowerCase()) || 
                                tool.description.toLowerCase().includes(term.toLowerCase());
            const matchCat = cat === 'all' || tool.category === cat;
            const matchStat = stat === 'all' || tool.status === stat;

            if (matchSearch && matchCat && matchStat) {
                const card = document.createElement('div');
                card.className = 'tool-card';
                card.innerHTML = `
                    <h3>${tool.name}</h3>
                    <p>${tool.description}</p>
                    <span class="tag status-tag status-${tool.status ? tool.status.toLowerCase() : 'stable'}">${tool.status}</span>
                    <div class="actions">
                        <a href="${tool.link}" target="_blank" class="btn-download">ดาวน์โหลด</a>
                        <button class="btn-edit" onclick="editTool('${tool.id}')">แก้ไข</button>
                        <button class="btn-delete" onclick="deleteTool('${tool.id}', '${tool.name}')">ลบ</button>
                    </div>
                `;
                toolList.appendChild(card);
                count++;
            }
        });
        resultCountDisplay.textContent = `พบ ${count} รายการ`;
    };

    window.onclick = (e) => {
        if (e.target == addToolModal) addToolModal.style.display = 'none';
        if (e.target == categoryModal) categoryModal.style.display = 'none';
    };

    if (closeCategoryModal) closeCategoryModal.onclick = () => categoryModal.style.display = 'none';

    if (clearSearchButton) {
        clearSearchButton.onclick = () => {
            searchInput.value = '';
            setFilter('all');
        };
    }

    loadCategories();
});

// === ฟังก์ชัน Global (เรียกใช้จาก HTML/Dynamic Content) ===
async function editTool(id) {
    const pin = prompt("กรุณาใส่ PIN เพื่อแก้ไข:");
    if (pin !== "271046") return alert("PIN ไม่ถูกต้อง");
    
    const doc = await db.collection("tools").doc(id).get();
    const data = doc.data();
    document.getElementById('documentId').value = id;
    document.getElementById('toolName').value = data.name;
    document.getElementById('toolDesc').value = data.description;
    document.getElementById('toolLink').value = data.link;
    document.getElementById('toolCategory').value = data.category;
    document.getElementById('toolStatus').value = data.status;
    document.getElementById('addToolModal').querySelector('h2').textContent = '✏️ แก้ไขเครื่องมือ';
    document.getElementById('addToolModal').style.display = 'block';
}

async function deleteTool(id, name) {
    const pin = prompt(`ยืนยัน PIN เพื่อลบ "${name}":`);
    if (pin !== "271046") return alert("PIN ไม่ถูกต้อง");
    
    if (confirm(`ต้องการลบเครื่องมือ "${name}" ใช่หรือไม่?`)) {
        await db.collection("tools").doc(id).delete();
        alert("ลบสำเร็จ!");
    }
}

function editCategory(id, name, order) {
    document.getElementById('categoryId').value = id;
    document.getElementById('categoryName').value = name;
    document.getElementById('categoryIDInput').value = id;
    document.getElementById('categoryIDInput').disabled = true;
    document.getElementById('categoryOrder').value = order;
}

async function deleteCategory(id, name) {
    const pin = prompt(`ยืนยัน PIN เพื่อลบหมวดหมู่ "${name}":`);
    if (pin !== "271046") return alert("PIN ไม่ถูกต้อง");
    
    if (confirm(`ลบหมวดหมู่จะทำให้เครื่องมือในกลุ่มนี้หาไม่เจอ ต้องการลบ "${name}" หรือไม่?`)) {
        await db.collection("categories").doc(id).delete();
        alert("ลบสำเร็จ!");
    }
}