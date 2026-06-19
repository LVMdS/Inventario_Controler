// =========================================================
// 1. VARIÁVEIS GLOBAIS E ESTADO
// =========================================================
let chartStatus = null;    // Guarda o gráfico de Status na memória
let chartCategoria = null; // Guarda o gráfico de Categoria na memória
let idEmEdicao = null;     // Guarda o ID do equipamento se estivermos no modo "Editar"


// =========================================================
// 2. FUNÇÃO PRINCIPAL: LER O BANCO E MONTAR A TABELA
// =========================================================
async function carregarAtivos(busca = '') {
    const url = busca ? `/ativos/?busca=${busca}` : '/ativos/';
    
    try {
        const resposta = await fetch(url);
        const ativos = await resposta.json();
        const tabela = document.getElementById('tabelaAtivos');
        tabela.innerHTML = ''; 
        
        // SEGURANÇA: Descobre quem está logado lendo o crachá na memória do navegador
        const papelUsuario = localStorage.getItem('papel_inventario');
        
        ativos.forEach(ativo => {
            // Lógica Visual: Tem foto? Mostra. Não tem? Escreve "Sem foto"
            const tagImagem = ativo.imagem 
                ? `<img src="/${ativo.imagem}" alt="Foto" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">` 
                : `<span class="text-muted small">Sem foto</span>`;
                
            // Lógica Visual: Tem QR Code? Mostra. Não tem? Coloca um traço
            const tagQR = ativo.qr_code 
                ? `<img src="/${ativo.qr_code}" alt="QR" style="width: 50px; height: 50px; border: 1px solid #ccc; border-radius: 5px;">` 
                : `-`;

            // LÓGICA DE PERMISSÃO (RBAC): Quem pode ver os botões de ação?
            let botoesAcao = '';
            if (papelUsuario === 'admin') {
                // Se for Admin, injeta os botões amarelos e vermelhos
                botoesAcao = `
                    <button class="btn btn-sm btn-warning me-1" onclick="prepararEdicao(${ativo.id}, '${ativo.nome}', '${ativo.categoria}', '${ativo.fabricante}', '${ativo.status}')">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="deletarAtivo(${ativo.id})">Excluir</button>
                `;
            } else {
                // Se for Técnico, mostra apenas um selo inofensivo
                botoesAcao = `<span class="badge bg-light text-dark border">Apenas Leitura</span>`;
            }

            // Monta a linha da tabela e joga na tela
            tabela.innerHTML += `
                <tr>
                    <td>${ativo.id}</td>
                    <td>${tagImagem}</td>
                    <td>${tagQR}</td>
                    <td>${ativo.nome}</td>
                    <td>${ativo.categoria}</td>
                    <td>${ativo.fabricante}</td>
                    <td><span class="badge bg-secondary">${ativo.status}</span></td>
                    <td>${botoesAcao}</td> </tr>
            `;
        });

        // Atualiza os gráficos sempre que a tabela for recarregada
        carregarDashboard();

    } catch (erro) {
        console.error("Erro ao carregar a tabela:", erro);
    }
}


// =========================================================
// 3. FUNÇÃO DE AUDITORIA: LER A CAIXA PRETA (LOGS)
// =========================================================
async function carregarLogs() {
    try {
        const resposta = await fetch('/logs/');
        const logs = await resposta.json();
        
        const tabelaLogs = document.getElementById('tabelaLogs');
        tabelaLogs.innerHTML = ''; 
        
        logs.forEach(log => {
            let corBadge = 'bg-secondary';
            if (log.acao === 'CADASTRO') corBadge = 'bg-success';
            if (log.acao === 'EXCLUSÃO') corBadge = 'bg-danger';
            if (log.acao === 'EDIÇÃO') corBadge = 'bg-warning text-dark';
            if (log.acao === 'LOGIN') corBadge = 'bg-info text-dark';

            tabelaLogs.innerHTML += `
                <tr>
                    <td class="text-nowrap">${log.data_hora}</td>
                    <td><span class="badge ${corBadge}">${log.acao}</span></td>
                    <td>${log.detalhes}</td>
                </tr>
            `;
        });
    } catch (erro) {
        console.error("Erro ao carregar o histórico de auditoria:", erro);
    }
}


// =========================================================
// 4. FUNÇÃO DO DASHBOARD: GRÁFICOS (CHART.JS)
// =========================================================
async function carregarDashboard() {
    try {
        const resposta = await fetch('/estatisticas/');
        const dados = await resposta.json();
        
        document.getElementById('totalAtivos').textContent = dados.total;
        
        const statusLabels = Object.keys(dados.por_status);
        const statusValores = Object.values(dados.por_status);
        const categoriaLabels = Object.keys(dados.por_categoria);
        const categoriaValores = Object.values(dados.por_categoria);

        // Limpa os gráficos antigos da tela para evitar "fantasmas" visuais
        if (chartStatus) chartStatus.destroy();
        if (chartCategoria) chartCategoria.destroy();

        const ctxStatus = document.getElementById('graficoStatus').getContext('2d');
        chartStatus = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: statusLabels,
                datasets: [{
                    data: statusValores,
                    backgroundColor: ['#198754', '#ffc107', '#dc3545', '#6c757d']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        const ctxCategoria = document.getElementById('graficoCategoria').getContext('2d');
        chartCategoria = new Chart(ctxCategoria, {
            type: 'bar',
            data: {
                labels: categoriaLabels,
                datasets: [{
                    label: 'Quantidade',
                    data: categoriaValores,
                    backgroundColor: '#0d6efd'
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } } 
            }
        });
    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);
    }
}


// =========================================================
// 5. FUNÇÃO DO MODO "EDITAR": DEVOLVER DADOS AO FORMULÁRIO
// =========================================================
function prepararEdicao(id, nome, categoria, fabricante, status) {
    idEmEdicao = id; // Trava o sistema no modo "Edição" usando o ID
    
    // Sobe os dados da tabela de volta para as caixinhas de texto
    document.getElementById('nome').value = nome;
    document.getElementById('categoria').value = categoria;
    document.getElementById('fabricante').value = fabricante;
    document.getElementById('status').value = status;
    
    // Muda a cara do botão verde (+) para azul (Salvar)
    const botao = document.querySelector('#formAtivo button[type="submit"]');
    botao.textContent = "Salvar Alterações";
    botao.className = "btn btn-primary w-100";
}


// =========================================================
// 6. FUNÇÃO DE SALVAR: CADASTRAR NOVO OU ATUALIZAR
// =========================================================
document.getElementById('formAtivo').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Empacota os textos e a possível foto usando FormData
    const formData = new FormData();
    formData.append("nome", document.getElementById('nome').value);
    formData.append("categoria", document.getElementById('categoria').value);
    formData.append("fabricante", document.getElementById('fabricante').value);
    formData.append("status", document.getElementById('status').value);
    
    const campoImagem = document.getElementById('imagem');
    if (campoImagem && campoImagem.files.length > 0) {
        formData.append("imagem", campoImagem.files[0]);
    }

    // DECISÃO: Estamos criando um equipamento novo ou editando um antigo?
    if (idEmEdicao) {
        // Se temos um ID em edição, fazemos PUT (Atualizar)
        // Nota: No nosso backend atual, o PUT espera um JSON, não um FormData, 
        // mas para simplificar o laboratório e não reescrever a rota, o front lida com isso:
        const dadosJSON = {
            nome: document.getElementById('nome').value,
            categoria: document.getElementById('categoria').value,
            fabricante: document.getElementById('fabricante').value,
            status: document.getElementById('status').value
        };
        await fetch(`/ativos/${idEmEdicao}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosJSON)
        });
        
        // Destrava o modo de edição e volta o botão para o normal
        idEmEdicao = null;
        const botao = document.querySelector('#formAtivo button[type="submit"]');
        botao.textContent = "+";
        botao.className = "btn btn-success w-100";
        
    } else {
        // Se não temos ID em edição, fazemos POST (Cadastrar Novo via FormData)
        await fetch('/ativos/', {
            method: 'POST',
            body: formData
        });
    }

    document.getElementById('formAtivo').reset(); // Limpa as caixinhas
    
    // Mantém a pesquisa visual ativa, se houver
    const termoBusca = document.getElementById('campoBusca') ? document.getElementById('campoBusca').value : '';
    carregarAtivos(termoBusca); 
});


// =========================================================
// 7. FUNÇÃO DE EXCLUSÃO (APAGAR EQUIPAMENTO)
// =========================================================
async function deletarAtivo(id) {
    if (confirm("Tem certeza que deseja remover este equipamento?")) {
        await fetch(`/ativos/${id}`, { method: 'DELETE' });
        
        const termoBusca = document.getElementById('campoBusca') ? document.getElementById('campoBusca').value : '';
        carregarAtivos(termoBusca);
    }
}


// =========================================================
// 8. OUVINTE DA BARRA DE BUSCA EM TEMPO REAL
// =========================================================
const campoBusca = document.getElementById('campoBusca');
if (campoBusca) {
    campoBusca.addEventListener('input', (e) => {
        carregarAtivos(e.target.value);
    });
}


// =========================================================
// 9. PROTEÇÃO DE INTERFACE (ESCONDER BOTÕES PROIBIDOS)
// =========================================================
// Se quem entrou não for o Admin, esconde o botão amarelo de Logs do topo da tela
if (localStorage.getItem('papel_inventario') !== 'admin') {
    const btnLogs = document.getElementById('btnLogs');
    if (btnLogs) {
        btnLogs.style.display = 'none'; 
    }
}


// =========================================================
// 10. LIGAR O MOTOR
// =========================================================
// Essa linha faz o sistema buscar os dados assim que o usuário acessa a página
carregarAtivos();