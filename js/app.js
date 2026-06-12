// ==========================================
// 1. BASE DE DONNÉES & ACCÈS CRYPTOGRAPHIQUE
// ==========================================
const DB_NAME = "RegistreMedicalChiffreDB_Pro";
const DB_VERSION = 1;
const STORE_NAME = "examens_chiffres";
let db;
let CLE_CHIFFREMENT = "";

const pinInput = document.getElementById('pin-input');
const btnLogin = document.getElementById('btn-login');
const authOverlay = document.getElementById('auth-overlay');
const authError = document.getElementById('auth-error');
const authInstruction = document.getElementById('auth-instruction');

let configurationInitiale = !localStorage.getItem('app_pin_verif');
if (configurationInitiale) {
    authInstruction.textContent = "Première configuration : Définissez votre code PIN d'accès secret.";
}

btnLogin.addEventListener('click', function() {
    const pinSaisi = pinInput.value;
    if (pinSaisi.length < 4) {
        alert("Le code PIN doit comporter au moins 4 chiffres.");
        return;
    }

    if (configurationInitiale) {
        const empreinte = CryptoJS.AES.encrypt("VALIDE", pinSaisi).toString();
        localStorage.setItem('app_pin_verif', empreinte);
        CLE_CHIFFREMENT = pinSaisi;
        authOverlay.style.display = 'none';
        initialiserIndexedDB();
    } else {
        const empreinteStockee = localStorage.getItem('app_pin_verif');
        try {
            const octets = CryptoJS.AES.decrypt(empreinteStockee, pinSaisi);
            const texteDecrypte = octets.toString(CryptoJS.enc.Utf8);
            if (texteDecrypte === "VALIDE") {
                CLE_CHIFFREMENT = pinSaisi;
                authOverlay.style.display = 'none';
                initialiserIndexedDB();
            } else { afficherErreurAuthentification(); }
        } catch (e) { afficherErreurAuthentification(); }
    }
});

function afficherErreurAuthentification() {
    authError.style.display = 'block';
    pinInput.value = '';
}

function initialiserIndexedDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = function(e) {
        let dbInstance = e.target.result;
        if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
            dbInstance.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        }
    };
    request.onsuccess = function(e) {
        db = e.target.result;
        initialiserLesGraphiquesStyleCapture();
        rafraichirInterface();
    };
}

// ==========================================
// 2. LOGIQUE COMMUTATION DES ONGLETS (NAVIGATION)
// ==========================================
const navButtons = document.querySelectorAll('.nav-btn[data-target]');
navButtons.forEach(button => {
    button.addEventListener('click', function() {
        basculerVersOnglet(this.getAttribute('data-target'));
    });
});

function basculerVersOnglet(idSection) {
    document.querySelectorAll('.vue-onglet').forEach(el => el.classList.remove('vue-active'));
    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(idSection).classList.add('vue-active');
    const cibleBouton = document.querySelector(`.nav-btn[data-target="${idSection}"]`);
    if(cibleBouton) cibleBouton.classList.add('active');
}

// ==========================================
// 3. CONFIGURATION INITIALE DES TROIS GRAPHES
// ==========================================
let chartCRP, chartVSH, chartVitesse;

function initialiserLesGraphiquesStyleCapture() {
    const optionsJauge = () => ({
        responsive: true,
        maintainAspectRatio: false,
        rotation: -90,
        circumference: 180,
        cutout: '75%',
        plugins: {
            legend: { display: false },
            tooltip: { enabled: true }
        }
    });

    const ctxCRP = document.getElementById('gaugeCRP').getContext('2d');
    chartCRP = new Chart(ctxCRP, {
        type: 'doughnut',
        data: {
            labels: ['Zone Normale', 'Inflammation Modérée', 'Inflammation Aiguë Haute', 'Moyenne Groupe'],
            datasets: [{
                data: [25, 25, 50, 0],
                backgroundColor: ['#4ade80', '#fb923c', '#ef4444', '#1e293b'],
                borderWidth: 2
            }]
        },
        options: optionsJauge()
    });

    const ctxVSH = document.getElementById('gaugeVSH').getContext('2d');
    chartVSH = new Chart(ctxVSH, {
        type: 'doughnut',
        data: {
            labels: ['Zone Normale', 'Inflammation Modérée', 'Forte Inflammation', 'Moyenne Groupe'],
            datasets: [{
                data: [30, 20, 30, 0],
                backgroundColor: ['#4ade80', '#facc15', '#ef4444', '#1e293b'],
                borderWidth: 2
            }]
        },
        options: optionsJauge()
    });

    const ctxVitesse = document.getElementById('barChartVitesse').getContext('2d');
    chartVitesse = new Chart(ctxVitesse, {
        type: 'bar',
        data: {
            labels: ['Moyenne CRP', "Ratio d'Augmentation", 'Moyenne VSH'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#3b82f6', '#64748b', '#60a5fa'],
                borderRadius: 6,
                barThickness: 45
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { display: false, min: 0 } }
        }
    });

    // Écouteurs filtres de l'onglet courbe
    document.getElementById('analys-patho').addEventListener('change', calculerEtAfficherAnalysesGlobales);
    document.getElementById('analys-age-tranche').addEventListener('change', calculerEtAfficherAnalysesGlobales);
    document.getElementById('analys-sexe').addEventListener('change', calculerEtAfficherAnalysesGlobales);
}

// ==========================================
// 4. SAISIE ET CHIFFREMENT DES EXAMENS
// ==========================================
const form = document.getElementById('form-collecte');
const dashboardBody = document.getElementById('dashboard-body');
document.getElementById('p-date').valueAsDate = new Date();

function genererIdentifiantPatient(pathologie, age, sexe) {
    const prefixe = pathologie.substring(0, 3).toUpperCase().replace(/[\s\W]+/g, 'X');
    const codeSexe = sexe === "Femme" ? "F" : "H";
    const aleatoire = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefixe}-${age}${codeSexe}-${aleatoire}`;
}

form.addEventListener('submit', function(e) {
    e.preventDefault();
    const pathologie = document.getElementById('p-pathologie').value.trim();
    const age = parseInt(document.getElementById('p-age').value);
    const sexe = document.getElementById('p-sexe').value;

    const examData = {
        identifiant: genererIdentifiantPatient(pathologie, age, sexe),
        nom: document.getElementById('p-nom').value.trim(),
        lieu: document.getElementById('p-lieu').value.trim(),
        pathologie: pathologie,
        crp: parseInt(document.getElementById('p-crp').value),
        vsh: parseInt(document.getElementById('p-vsh').value),
        sexe: sexe,
        age: age,
        dateSaisie: new Date(document.getElementById('p-date').value).toLocaleDateString('fr-FR')
    };

    ajouterExamenEnBase(examData, () => {
        form.reset();
        document.getElementById('p-date').valueAsDate = new Date();
        alert(`Examen enregistré et crypté. ID du profil : ${examData.identifiant}`);
        rafraichirInterface();
        basculerVersOnglet('section-dashboard');
    });
});

function ajouterExamenEnBase(data, callback) {
    const payloadChiffre = CryptoJS.AES.encrypt(JSON.stringify(data), CLE_CHIFFREMENT).toString();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.add({ patientRef: data.identifiant, payload: payloadChiffre });
    transaction.oncomplete = callback;
}

function recupererTousLesExamensDechiffres(callback) {
    if (!db) return;
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const requestAll = store.getAll();

    requestAll.onsuccess = function() {
        const resultats = [];
        requestAll.result.forEach(item => {
            try {
                const octets = CryptoJS.AES.decrypt(item.payload, CLE_CHIFFREMENT);
                resultats.push(JSON.parse(octets.toString(CryptoJS.enc.Utf8)));
            } catch(e) { console.error("Erreur de décryptage d'une ligne."); }
        });
        callback(resultats);
    };
}

function rafraichirInterface() {
    recupererTousLesExamensDechiffres(function(examens) {
        construireDashboard(examens);
        calculerEtAfficherAnalysesGlobales();
    });
}

// ==========================================
// 5. FILTRAGE ET LOGIQUE DES COMPTEURS GLOBAUX
// ==========================================
function alimenterFiltrePathologies(examens) {
    const selectPatho = document.getElementById('analys-patho');
    const memo = selectPatho.value;
    const uniques = [...new Set(examens.map(e => e.pathologie.trim()))].sort();
    
    selectPatho.innerHTML = '<option value="">-- Toutes les pathologies --</option>';
    uniques.forEach(patho => {
        if(patho) {
            const opt = document.createElement('option');
            opt.value = patho.toLowerCase(); opt.textContent = patho;
            selectPatho.appendChild(opt);
        }
    });
    selectPatho.value = memo;
}

function calculerEtAfficherAnalysesGlobales() {
    recupererTousLesExamensDechiffres(function(tousExamens) {
        alimenterFiltrePathologies(tousExamens);

        const fPatho = document.getElementById('analys-patho').value;
        const fTranche = document.getElementById('analys-age-tranche').value;
        const fSexe = document.getElementById('analys-sexe').value;

        const examensFiltres = tousExamens.filter(e => {
            if (fPatho && e.pathologie.toLowerCase() !== fPatho) return false;
            if (fSexe && e.sexe !== fSexe) return false;
            if (fTranche) {
                let t = "Adulte";
                if (e.age < 18) t = "Enfant";
                if (e.age > 65) t = "Sénior";
                if (t !== fTranche) return false;
            }
            return true;
        });

        let sommeCRP = 0, sommeVSH = 0, n = examensFiltres.length;

        if (n > 0) {
            examensFiltres.forEach(e => { sommeCRP += e.crp; sommeVSH += e.vsh; });
            const moyCRP = Math.round(sommeCRP / n);
            const moyVSH = Math.round(sommeVSH / n);
            const ratioMoyen = moyVSH > 0 ? (moyCRP / moyVSH).toFixed(2) : 0;

            let crpGraph = Math.min(moyCRP, 100);
            chartCRP.data.datasets[0].data = [25, 25, 50 - crpGraph, crpGraph];
            document.getElementById('val-digital-crp').textContent = `${moyCRP} mg/L`;
            chartCRP.update();

            let vshGraph = Math.min(moyVSH, 80);
            chartVSH.data.datasets[0].data = [30, 20, 30 - vshGraph, vshGraph];
            document.getElementById('val-digital-vsh').textContent = `${moyVSH} mm/h`;
            chartVSH.update();

            chartVitesse.data.datasets[0].data = [moyCRP, ratioMoyen * 15, moyVSH];
            chartVitesse.update();
        } else {
            chartCRP.data.datasets[0].data = [25, 25, 50, 0];
            document.getElementById('val-digital-crp').textContent = "0 mg/L";
            chartCRP.update();

            chartVSH.data.datasets[0].data = [30, 20, 30, 0];
            document.getElementById('val-digital-vsh').textContent = "0 mm/h";
            chartVSH.update();

            chartVitesse.data.datasets[0].data = [0, 0, 0];
            chartVitesse.update();
        }
    });
}

// ==========================================
// 6. GESTION INTERACTIVE DU TABLEAU DE BORD
// ==========================================
const filtreTableauPatho = document.getElementById('filtre-pathologie');
const filtreTableauCRP = document.getElementById('filtre-crp');

function construireDashboard(examens) {
    const derniersStatuts = {};
    examens.forEach(e => { derniersStatuts[e.identifiant] = e; });
    dashboardBody.innerHTML = "";
    
    for (const id in derniersStatuts) {
        const e = derniersStatuts[id];
        const ratio = (e.crp / e.vsh).toFixed(2);
        if (filtreTableauPatho.value && !e.pathologie.toLowerCase().includes(filtreTableauPatho.value.toLowerCase())) continue;
        if (filtreTableauCRP.value && e.crp < parseInt(filtreTableauCRP.value)) continue;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${e.identifiant}</strong></td>
            <td>${e.pathologie}</td>
            <td>${e.crp >= 100 ? '<span class="badge-alerte">'+e.crp+'</span>' : e.crp}</td>
            <td>${e.vsh}</td>
            <td>${ratio}</td>
            <td>${e.dateSaisie}</td>
        `;

        tr.addEventListener('click', function() {
            // Au clic, on configure les filtres globaux sur la pathologie de la ligne sélectionnée
            document.getElementById('analys-patho').value = e.pathologie.toLowerCase();
            document.getElementById('analys-sexe').value = "";
            document.getElementById('analys-age-tranche').value = "";
            
            calculerEtAfficherAnalysesGlobales();
            basculerVersOnglet('section-courbe');
        });

        dashboardBody.appendChild(tr);
    }
}

filtreTableauPatho.addEventListener('input', () => recupererTousLesExamensDechiffres(construireDashboard));
filtreTableauCRP.addEventListener('input', () => recupererTousLesExamensDechiffres(construireDashboard));

// ==========================================
// 7. GESTION DES BACKUPS (EXPORT ET IMPORT)
// ==========================================
document.getElementById('btn-export-nav').addEventListener('click', function() {
    recupererTousLesExamensDechiffres(function(examens) {
        if (examens.length === 0) return;
        let csv = "\uFEFFPatient_ID;Nom_Patient;Lieu_Patient;Pathologie;CRP;VSH;Sexe;Age;Date_Examen\n";
        examens.forEach(p => {
            csv += `${p.identifiant};"${p.nom}";"${p.lieu}";"${p.pathologie}";${p.crp};${p.vsh};${p.sexe};${p.age};${p.dateSaisie}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `backup_registre_medical.csv`;
        link.click();
    });
});

document.getElementById('input-import').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const lignes = e.target.result.split('\n');
        let count = 0;
        for(let i = 1; i < lignes.length; i++) {
            const cols = lignes[i].trim().split(';');
            if (cols.length < 9) continue;
            const examData = {
                identifiant: cols[0], nom: cols[1].replace(/"/g, ''), lieu: cols[2].replace(/"/g, ''),
                pathologie: cols[3].replace(/"/g, ''), crp: parseInt(cols[4]), vsh: parseInt(cols[5]),
                sexe: cols[6], age: parseInt(cols[7]), dateSaisie: cols[8]
            };
            ajouterExamenEnBase(examData, () => {});
            count++;
        }
        setTimeout(() => { 
            alert(`${count} dossiers importés et rechiffrés.`); 
            rafraichirInterface(); 
            basculerVersOnglet('section-courbe');
        }, 500);
    };
    reader.readAsText(file);
});