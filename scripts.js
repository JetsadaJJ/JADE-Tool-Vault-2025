document.addEventListener('DOMContentLoaded', () => {
    // === 1. การตั้งค่าความปลอดภัย (PIN) ===
    const ADMIN_PIN = "271046"; // <<< PIN Code ของคุณ

    if (typeof db === 'undefined') {
        console.error("Firebase db is not initialized. Please check your index.html configuration.");
        return;
    }

    // 2. กำหนดตัวแปรสำหรับองค์ประกอบหลัก
    const toolList = document.getElementById('tool-list');
    const addToolForm = document.getElementById('addToolForm');
    const searchInput = document.getElementById('searchInput');
    // เปลี่ยน: ไม่ใช้ categoryButtons เดิมแล้ว แต่ใช้ Container แทน
    const categoryContainer = document.querySelector('.categories'); 
    const toolCategorySelect = document.getElementById('toolCategory'); // Select ใน Add Modal
    
    
    // ตัวแปรสำหรับ Status Filter และ Count
    const statusButtons = document.querySelectorAll('.status-filters button');
    const resultCountDisplay = document.createElement('h4');
    resultCountDisplay.id = 'resultCountDisplay';
    resultCountDisplay.style.marginBottom = '20px';
    resultCountDisplay.style.maxWidth = '1200px';
    resultCountDisplay.style.margin = '20px auto 20px auto';
    toolList.parentNode.insertBefore(resultCountDisplay, toolList); 
    
    // 2.5 ตัวแปรสำหรับ Tool Modal
    const fabButton = document.getElementById('fabButton');
    const addToolModal = document.getElementById('addToolModal');
    const closeButton = addToolModal ? addToolModal.querySelector('.close-button') : null;
    const modalTitle = addToolModal.querySelector('h2'); 
    
    // ตัวแปรสำหรับฟิลด์ใหม่
    const documentIdField = document.getElementById('documentId');
    const toolStatusField = document.getElementById('toolStatus'); 
    const clearSearchButton = document.getElementById('clearSearchButton');
    
    // ตัวแปรใหม่สำหรับ Category Management
    // const manageCategoriesButton = document.getElementById('manageCategoriesButton'); // ไม่จำเป็นต้องใช้แล้ว
    const categoryModal = document.getElementById('categoryModal');
    const closeCategoryModal = document.getElementById('closeCategoryModal');
    const categoryForm = document.getElementById('categoryForm');
    const currentCategoryList = document.getElementById('currentCategoryList');
    const categorySubmitButton = document.getElementById('categorySubmitButton');
    
    // ฟอร์มฟิลด์ Category
    const categoryIdField = document.getElementById('categoryId');
    const categoryNameInput = document.getElementById('categoryName');
    const categoryIDInput = document.getElementById('categoryIDInput');
    const categoryOrderInput = document.getElementById('categoryOrder');

    let currentFilter = 'all'; 
    let currentStatusFilter = 'all'; 
    let allTools = []; 
    let availableCategories = []; // เก็บรายการหมวดหมู่ที่โหลดมาจาก Firebase

    // --- ส่วนที่ 0: การจัดการ Modal และ PIN Check (ปรับปรุงใหม่) ----------------------
    
    const checkPinAndExecute = (action, onSuccess) => {
        const pin = prompt("กรุณาใส่ PIN Code เพื่อดำเนินการ:");
        if (pin === ADMIN_PIN) {
            onSuccess();
        } else {
            alert(`PIN Code ไม่ถูกต้อง! การ${action}ถูกยกเลิก`);
        }
    };
    
    // เปลี่ยน Event Listener ของ FAB (สร้างเครื่องมือ)
    if (fabButton && addToolModal && closeButton) {
        fabButton.addEventListener('click', () => {
            checkPinAndExecute('เพิ่มเครื่องมือ', () => {
                modalTitle.textContent = '+ เพิ่มเครื่องมือใหม่';
                documentIdField.value = ''; 
                addToolForm.reset(); 
                addToolModal.style.display = 'block';
            });
        });

        closeButton.addEventListener('click', () => {
            addToolModal.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target == addToolModal) {
                addToolModal.style.display = 'none';
            }
        });
    }

    // Event Listener สำหรับ Modal ปิด/เปิด
    if (categoryModal && closeCategoryModal) {
        closeCategoryModal.addEventListener('click', () => {
            categoryModal.style.display = 'none';
            categoryForm.reset();
            categorySubmitButton.textContent = 'บันทึกหมวดหมู่';
            categoryIDInput.disabled = false;
        });
        
        window.addEventListener('click', (event) => {
            if (event.target == categoryModal) {
                categoryModal.style.display = 'none';
            }
        });
    }


    // ฟังก์ชันแปลง Timestamp เป็น Date string
    const formatTimestamp = (timestamp) => {
        if (!timestamp || !timestamp.toDate) return '—';
        return timestamp.toDate().toLocaleDateString('th-TH', { 
            year: 'numeric', month: 'short', day: 'numeric' 
        });
    };
    
    // --- ส่วนที่ 1: การจัดการข้อมูลหมวดหมู่ (CRUD Category) ------------------
    
    // ฟังก์ชันสร้างรายการหมวดหมู่ใน Admin Modal
    const renderCategoryAdminList = () => {
        currentCategoryList.innerHTML = '';
        // ใช้ availableCategories ที่โหลดมาแล้ว
        availableCategories.forEach(cat => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${cat.name} (ID: ${cat.id}) [Order: ${cat.order}]</span>
                <div class="category-admin-actions">
                    <button class="btn-edit-cat" data-id="${cat.id}">แก้ไข</button>
                    <button class="btn-delete-cat" data-id="${cat.id}">ลบ</button>
                </div>
            `;
            
            // Event Listener แก้ไขหมวดหมู่
            li.querySelector('.btn-edit-cat').addEventListener('click', () => {
                categoryNameInput.value = cat.name;
                categoryIDInput.value = cat.id;
                categoryIDInput.disabled = true; // ล็อก ID เมื่อแก้ไข
                categoryOrderInput.value = cat.order;
                categoryIdField.value = cat.id; // ใช้ field hidden เก็บ ID
                categorySubmitButton.textContent = 'อัปเดตหมวดหมู่';
            });
            
            // Event Listener ลบหมวดหมู่
            li.querySelector('.btn-delete-cat').addEventListener('click', () => {
                checkPinAndExecute('ลบหมวดหมู่', async () => {
                    if (confirm(`คุณต้องการลบหมวดหมู่ "${cat.name}" ใช่หรือไม่?`)) {
                        try {
                            await db.collection("categories").doc(cat.id).delete();
                            alert(`ลบหมวดหมู่ ${cat.name} สำเร็จ!`);
                        } catch (error) {
                            console.error("Error removing category: ", error);
                            alert("เกิดข้อผิดพลาดในการลบหมวดหมู่");
                        }
                    }
                });
            });
            
            currentCategoryList.appendChild(li);
        });
    };
    
    // จัดการ Submit Form หมวดหมู่
    if (categoryForm) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = categoryIdField.value || categoryIDInput.value.toLowerCase().trim();
            const categoryData = {
                name: categoryNameInput.value.trim(),
                order: parseInt(categoryOrderInput.value),
                // timestamp จะถูกเซ็ต/อัปเดตใน Firebase Rules หรือถ้าเป็นการสร้างใหม่
            };
            
            checkPinAndExecute(categoryIdField.value ? 'อัปเดตหมวดหมู่' : 'สร้างหมวดหมู่', async () => {
                try {
                    if (categoryIdField.value) {
                        // โหมดแก้ไข (Update)
                        await db.collection("categories").doc(categoryIdField.value).update(categoryData);
                        alert("อัปเดตหมวดหมู่สำเร็จ!");
                    } else {
                        // โหมดสร้าง (Create)
                        await db.collection("categories").doc(id).set({
                            ...categoryData,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        alert("บันทึกหมวดหมู่สำเร็จ!");
                    }
                    
                    categoryForm.reset(); 
                    categorySubmitButton.textContent = 'บันทึกหมวดหมู่';
                    categoryIDInput.disabled = false;
                    categoryIdField.value = '';
                } catch (error) {
                    console.error("Error saving category: ", error);
                    alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลหมวดหมู่");
                }
            });
        });
    }

    // ฟังก์ชันสร้างปุ่มหมวดหมู่ในหน้าหลัก (Dynamic)
    const renderCategoryButtons = () => {
        categoryContainer.innerHTML = '';
        
        // 1. ปุ่ม 'ทั้งหมด' (ต้องมีเสมอ)
        const allButton = document.createElement('button');
        allButton.setAttribute('data-filter', 'all');
        allButton.className = currentFilter === 'all' ? 'active' : '';
        allButton.textContent = 'ทั้งหมด';
        categoryContainer.appendChild(allButton);

        // 2. ปุ่มหมวดหมู่ที่ดึงมาจาก Firebase
        availableCategories.forEach(cat => {
            const button = document.createElement('button');
            button.setAttribute('data-filter', cat.id);
            button.className = currentFilter === cat.id ? 'active' : '';
            button.textContent = cat.name;
            categoryContainer.appendChild(button);
        });
        
        // ************************************************************
        // * FIX: สร้างและแนบปุ่มไอคอนจัดการหมวดหมู่แบบ Dynamic *
        // ************************************************************
        const manageButton = document.createElement('button');
        manageButton.id = 'manageCategoriesButton';
        manageButton.className = 'category-icon-button';
        manageButton.title = 'จัดการหมวดหมู่';
        manageButton.innerHTML = '⚙️'; // ไอคอนที่เราต้องการ
        categoryContainer.appendChild(manageButton);

        // 3. แนบ Event Listener ให้ปุ่มไอคอนที่เพิ่งสร้าง
        manageButton.addEventListener('click', () => {
            checkPinAndExecute('จัดการหมวดหมู่', () => {
                // โหลดรายการหมวดหมู่ปัจจุบันใน Admin Modal
                renderCategoryAdminList(); 
                categoryModal.style.display = 'block';
            });
        });
        
        // 4. เพิ่ม Event Listener ให้ปุ่มฟิลเตอร์ทั้งหมด (ยกเว้นปุ่มไอคอน)
        categoryContainer.querySelectorAll('button').forEach(button => {
            if (button.id === 'manageCategoriesButton') {
                return; // ข้ามปุ่มไอคอน
            }

            button.addEventListener('click', () => {
                currentFilter = button.getAttribute('data-filter');
                categoryContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                filterAndSearch(searchInput.value, currentFilter, currentStatusFilter);
            });
        });
    };

    // ฟังก์ชันสร้างตัวเลือกหมวดหมู่ใน Add Modal (Dynamic)
    const renderCategorySelect = () => {
        toolCategorySelect.innerHTML = '<option value="" disabled selected>เลือกหมวดหมู่</option>';
        availableCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            toolCategorySelect.appendChild(option);
        });
    };
    
    // Listener สำหรับโหลดหมวดหมู่จาก Firebase (Realtime)
    const loadCategories = () => {
        db.collection("categories").orderBy("order", "asc").onSnapshot((snapshot) => {
            availableCategories = [];
            snapshot.forEach((doc) => {
                availableCategories.push({ id: doc.id, ...doc.data() });
            });
            
            // อัปเดต UI ทั้งหมดที่เกี่ยวข้องกับหมวดหมู่
            renderCategoryButtons();
            renderCategorySelect();
            
            // ต้องเรียก loadTools ใหม่เสมอเพื่อให้รายการเครื่องมืออัปเดต
            loadTools(); 
        }, (error) => {
            console.error("Error fetching categories: ", error);
            // ถ้าโหลดหมวดหมู่ไม่ได้ ให้ใช้ค่า Default
            alert("ไม่สามารถโหลดรายการหมวดหมู่ได้ โปรดตรวจสอบ Firebase Rules");
        });
    };

    // --- ส่วนที่ 2: การแสดงผลและลบ (CRUD - Read & Delete) ------------------

    const setupEditForm = (tool, id) => {
        checkPinAndExecute('แก้ไขเครื่องมือ', () => {
            modalTitle.textContent = '✏️ แก้ไขเครื่องมือ';
            documentIdField.value = id;
            
            // กรอกข้อมูลเดิม
            document.getElementById('toolName').value = tool.name;
            document.getElementById('toolDesc').value = tool.description;
            document.getElementById('toolLink').value = tool.link;
            document.getElementById('toolCategory').value = tool.category;
            document.getElementById('toolStatus').value = tool.status || 'Stable'; 
            
            addToolModal.style.display = 'block';
        });
    };

    const createToolCard = (tool, id) => {
        const card = document.createElement('div');
        card.className = 'tool-card';
        card.setAttribute('data-category', tool.category);
        
        // หาชื่อหมวดหมู่ที่อ่านง่ายจาก availableCategories
        const categoryObject = availableCategories.find(cat => cat.id === tool.category);
        const categoryLabel = categoryObject ? categoryObject.name : (tool.category.charAt(0).toUpperCase() + tool.category.slice(1)); 
        
        const statusLabel = tool.status || 'Stable'; 

        card.innerHTML = `
            <h3>${tool.name}</h3>
            <p>${tool.description}</p>
            <span class="tag category-tag">${categoryLabel} Tool</span>
            <span class="tag status-tag status-${statusLabel.toLowerCase()}">${statusLabel}</span> 
            
            <div class="date-info">
                เพิ่มเมื่อ: ${formatTimestamp(tool.timestamp)} 
            </div>
            
            <div class="actions">
                <a href="${tool.link}" class="btn-download" target="_blank">📥 ดาวน์โหลด/ลิงก์</a>
                <button class="btn-edit" data-id="${id}">⚙️ แก้ไข</button>
                <button class="btn-delete" data-id="${id}">🗑️ ลบ</button>
            </div>
        `;

        // Event Listener สำหรับปุ่มแก้ไข (Edit)
        const editButton = card.querySelector('.btn-edit');
        editButton.addEventListener('click', () => {
            setupEditForm(tool, id);
        });

        // Event Listener สำหรับปุ่มลบ (Delete)
        const deleteButton = card.querySelector('.btn-delete');
        deleteButton.addEventListener('click', async () => {
            checkPinAndExecute('ลบเครื่องมือ', async () => {
                if (confirm(`คุณต้องการลบ "${tool.name}" ใช่หรือไม่?`)) {
                    try {
                        await db.collection("tools").doc(id).delete();
                        alert("ลบเครื่องมือสำเร็จ!");
                    } catch (error) {
                        console.error("Error removing document: ", error);
                        alert("เกิดข้อผิดพลาดในการลบข้อมูล");
                    }
                }
            });
        });
        
        return card;
    };
    
    // --- ส่วนที่ 3: การค้นหาและการกรอง (Filter & Search) --------------------
    
    const filterAndSearch = (searchTerm, filterCategory, filterStatus) => {
        const term = searchTerm.toLowerCase().trim();
        toolList.innerHTML = ''; 
        let visibleCount = 0; 

        allTools.forEach(tool => {
            const cardName = tool.name.toLowerCase();
            const cardDescription = tool.description.toLowerCase();
            
            // 1. กรองด้วยข้อความค้นหา
            const matchesSearch = cardName.includes(term) || cardDescription.includes(term);
            
            // 2. กรองด้วยหมวดหมู่
            const matchesCategory = filterCategory === 'all' || tool.category === filterCategory;
            
            // 3. กรองด้วยสถานะ
            const toolStatus = tool.status || 'Stable';
            const matchesStatus = filterStatus === 'all' || toolStatus === filterStatus;


            if (matchesSearch && matchesCategory && matchesStatus) {
                toolList.appendChild(createToolCard(tool, tool.id));
                visibleCount++;
            }
        });
        
        resultCountDisplay.textContent = `พบ ${visibleCount} รายการ`;
    };
    
    // ฟังก์ชัน Realtime Listener สำหรับ Tools
    const loadTools = () => {
        db.collection("tools").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
            allTools = []; 
            
            snapshot.forEach((doc) => {
                const toolData = doc.data();
                allTools.push({ ...toolData, id: doc.id });
            });
            
            filterAndSearch(searchInput.value, currentFilter, currentStatusFilter);
        }, (error) => {
            console.error("Error fetching documents: ", error);
            toolList.innerHTML = '<p>เกิดข้อผิดพลาดในการโหลดข้อมูลเครื่องมือ</p>'; 
            resultCountDisplay.textContent = 'พบ 0 รายการ';
        });
    };
    
    // --- ส่วนที่ 5: Event Listeners เดิม (ปรับให้เรียก filterAndSearch) --------------------
    
    searchInput.addEventListener('input', (event) => {
        filterAndSearch(event.target.value, currentFilter, currentStatusFilter);
    });

    // Event Listener สำหรับปุ่มสถานะ
    statusButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentStatusFilter = button.getAttribute('data-status');
            statusButtons.forEach(btn => btn.classList.remove('status-active'));
            button.classList.add('status-active');
            filterAndSearch(searchInput.value, currentFilter, currentStatusFilter);
        });
    });

    // Event Listener สำหรับปุ่มล้างตัวกรอง
    if (clearSearchButton) {
        clearSearchButton.addEventListener('click', () => {
            searchInput.value = ''; 
            currentFilter = 'all'; 
            currentStatusFilter = 'all'; 

            // ต้องใช้ categoryContainer.querySelectorAll เพราะปุ่มถูกสร้างแบบ Dynamic
            categoryContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            categoryContainer.querySelector('button[data-filter="all"]').classList.add('active');
            
            statusButtons.forEach(btn => btn.classList.remove('status-active'));
            document.querySelector('.status-filters button[data-status="all"]').classList.add('status-active');

            filterAndSearch('', 'all', 'all'); 
        });
    }

    // เริ่มต้นโหลดหมวดหมู่ (ซึ่งจะไปเรียก loadTools อีกที)
    loadCategories();
});
