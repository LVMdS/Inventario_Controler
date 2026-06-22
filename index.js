// =========================================================
// 1. VARIÁVEIS GLOBAIS E ESTADO
// =========================================================
let chartStatus = null;    // Guarda o gráfico de Status na memória
let chartCategoria = null; // Guarda o gráfico de Categoria na memória
let idEmEdicao = null;     // Guarda o ID do equipamento se estivermos no modo "Editar"
const papelUsuario = localStorage.getItem('papel_inventario'); // Pega o perfil uma vez só


// =========================================================
// 2. FUNÇÃO PRINCIPAL: LER O BANCO E MONTAR A TABELA
// =========================================================
async function carregarAtivos(busca = '') {
    const url = busca ? `/ativos/?busca=${encodeURIComponent(busca)}` : '/ativos/';
    
    try {
        const resposta = await fetch(url);
        const ativos = await resposta.json();
        const tabela = document.getElementById('tabelaAtivos');
        tabela.innerHTML = ''; 
        

        ativos.forEach(ativo => {
            // Lógica Visual: Tem foto? Mostra. Não tem? Escreve "Sem foto"
            const tagImagem = ativo.imagem 
                ? `<img src="/${ativo.imagem}" alt="Foto" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">` 
                : `<span class="text-muted small">Sem foto</span>`;
                
            // Lógica Visual: Tem QR Code? Mostra. Não tem? Coloca um traço
            const tagQR = ativo.qr_code 
                ? `<img src="/${ativo.qr_code}" alt="QR Code" style="width: 50px; height: 50px; border: 1px solid #ccc; border-radius: 5px;">` 
                : `<span class="text-muted">-</span>`;

            //  LÓGICA DE PERMISSÃO (RBAC) - MELHORADA
            let botoesAcao = '';
            if (papelUsuario === 'admin') {
                // Admin: acesso total
                botoesAcao = `
                    <button class="btn btn-sm btn-warning me-1" onclick="prepararEdicao(${ativo.id}, '${ativo.nome.replace(/'/g, "\\'")}', '${ativo.categoria.replace(/'/g, "\\'")}', '${ativo.fabricante.replace(/'/g, "\\'")}', '${ativo.status}')">
                        ✏️ Editar
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deletarAtivo(${ativo.id})">
                        🗑️ Excluir
                    </button>
                `;
            } else if (papelUsuario === 'tecnico') {
                // Técnico: PODE EDITAR, NÃO PODE EXCLUIR
                botoesAcao = `
                    <button class="btn btn-sm btn-warning me-1" onclick="prepararEdicao(${ativo.id}, '${ativo.nome.replace(/'/g, "\\'")}', '${ativo.categoria.replace(/'/g, "\\'")}', '${ativo.fabricante.replace(/'/g, "\\'")}', '${ativo.status}')">
                        ✏️ Editar
                    </button>
                    <span class="badge bg-light text-dark border">🔒 Sem Acesso</span>
                `;
            } else {
                // Visitante ou perfil desconhecido: apenas visualização
                botoesAcao = `<span class="badge bg-secondary text-white">👁️ Apenas Leitura</span>`;
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
                    <td>${botoesAcao}</td> 
                </tr>
            `;
        });

        // Atualiza os gráficos sempre que a tabela for recarregada
        carregarDashboard();

    } catch (erro) {
        console.error("Erro ao carregar a tabela:", erro);
        alert("Erro ao buscar dados do servidor!");
    }
}


// =========================================================
// 3. FUNÇÃO DE AUDITORIA: LER A CAIXA PRETA (LOGS)
// =========================================================
async function carregarLogs() {
    // Segurança extra: só executa se for admin
    if (papelUsuario !== 'admin') {
        alert("Acesso negado: Apenas administradores podem visualizar o histórico!");
        return;
    }

    try {
        const resposta = await fetch('/logs/');
        const logs = await resposta.json();
        
        const tabelaLogs = document.getElementById('tabelaLogs');
        tabelaLogs.innerHTML = ''; 
        
        logs.forEach(log => {
            let corBadge = 'bg-secondary';
            if (log.acao === 'CADASTRO') corBadge = 'bg-success text-white';
            if (log.acao === 'EXCLUSÃO') corBadge = 'bg-danger text-white';
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
        
        const statusLabels = Object.keys(dados.por_status || {});
        const statusValores = Object.values(dados.por_status || {});
        const categoriaLabels = Object.keys(dados.por_categoria || {});
        const categoriaValores = Object.values(dados.por_categoria || {});

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
                    backgroundColor: ['#198754', '#ffc107', '#dc3545', '#6c757d', '#0d6efd']
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });

        const ctxCategoria = document.getElementById('graficoCategoria').getContext('2d');
        chartCategoria = new Chart(ctxCategoria, {
            type: 'bar',
            data: {
                labels: categoriaLabels,
                datasets: [{
                    label: 'Quantidade',
                    data: categoriaValores,
                    backgroundColor: '#0d6efd',
                    borderRadius: 4
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

    // Rola a página para o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
}


// =========================================================
// 6. FUNÇÃO DE SALVAR: CADASTRAR NOVO OU ATUALIZAR
// =========================================================
document.getElementById('formAtivo').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Empacota os textos e a possível foto usando FormData
    const formData = new FormData();
    formData.append("nome", document.getElementById('nome').value.trim());
    formData.append("categoria", document.getElementById('categoria').value.trim());
    formData.append("fabricante", document.getElementById('fabricante').value.trim());
    formData.append("status", document.getElementById('status').value);
    
    const campoImagem = document.getElementById('imagem');
    if (campoImagem && campoImagem.files.length > 0) {
        formData.append("imagem", campoImagem.files[0]);
    }

    try {
        // DECISÃO: Estamos criando um equipamento novo ou editando um antigo?
        if (idEmEdicao) {
            // Se temos um ID em edição, fazemos PUT (Atualizar)
            const dadosJSON = {
                nome: document.getElementById('nome').value.trim(),
                categoria: document.getElementById('categoria').value.trim(),
                fabricante: document.getElementById('fabricante').value.trim(),
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
            alert("✅ Equipamento atualizado com sucesso!");
            
        } else {
            // Se não temos ID em edição, fazemos POST (Cadastrar Novo via FormData)
            await fetch('/ativos/', {
                method: 'POST',
                body: formData
            });
            alert("✅ Equipamento cadastrado com sucesso!");
        }

        document.getElementById('formAtivo').reset(); // Limpa as caixinhas
        
        // Mantém a pesquisa visual ativa, se houver
        const termoBusca = document.getElementById('campoBusca') ? document.getElementById('campoBusca').value : '';
        carregarAtivos(termoBusca); 

    } catch (erro) {
        console.error("Erro ao salvar:", erro);
        alert("❌ Erro ao salvar os dados!");
    }
});


// =========================================================
// 7. FUNÇÃO DE EXCLUSÃO (APAGAR EQUIPAMENTO)
// =========================================================
async function deletarAtivo(id) {
    // Dupla verificação: não deixa técnico chamar a função por código
    if (papelUsuario !== 'admin') {
        alert("Acesso negado: Apenas administradores podem excluir!");
        return;
    }

    if (confirm("⚠️ ATENÇÃO: Tem certeza que deseja remover este equipamento? Essa ação não pode ser desfeita!")) {
        try {
            await fetch(`/ativos/${id}`, { method: 'DELETE' });
            const termoBusca = document.getElementById('campoBusca') ? document.getElementById('campoBusca').value : '';
            carregarAtivos(termoBusca);
            alert("🗑️ Equipamento removido com sucesso!");
        } catch (erro) {
            console.error("Erro ao excluir:", erro);
            alert("❌ Erro ao excluir o equipamento!");
        }
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
// Executa ajustes visuais baseados no perfil
window.addEventListener('DOMContentLoaded', () => {
    if (papelUsuario !== 'admin') {
        // Esconde botões exclusivos de admin
        const btnLogs = document.getElementById('btnLogs');
        const btnExportar = document.getElementById('btnExportar');
        const btnUsuarios = document.getElementById('btnUsuarios');
        
        if (btnLogs) btnLogs.style.display = 'none';
        if (btnExportar) btnExportar.style.display = 'none';
        if (btnUsuarios) btnUsuarios.style.display = 'none';
    }
});


// =========================================================
// GERENCIAMENTO DE USUÁRIOS (COMPLETO: LISTAR, EDITAR, REMOVER)
// =========================================================

// Carrega lista de usuários
async function carregarUsuarios() {
    if (papelUsuario !== 'admin') return;

    try {
        const resposta = await fetch('/usuarios/', {
            headers: { "token": localStorage.getItem("token_inventario") }
        });
        const usuarios = await resposta.json();
        const tabela = document.getElementById('tabelaUsuarios');
        tabela.innerHTML = '';

        usuarios.forEach(user => {
            tabela.innerHTML += `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.usuario}</td>
                    <td><span class="badge bg-info">${user.papel}</span></td>
                    <td>
                        ${user.usuario !== 'admin' ? `
                        <button class="btn btn-sm btn-warning me-1" onclick="prepararEdicaoUsuario(${user.id}, '${user.usuario}', '${user.papel}')">✏️ Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="excluirUsuario(${user.id}, '${user.usuario}')">🗑️ Excluir</button>
                        ` : '<span class="text-muted">🔒 Admin Principal</span>'}
                    </td>
                </tr>
            `;
        });

    } catch (erro) {
        console.error("Erro ao carregar usuários:", erro);
        alert("Erro ao buscar usuários!");
    }
}

// Prepara formulário para edição de usuário
function prepararEdicaoUsuario(id, nome, papel) {
    document.getElementById('tituloFormUsuario').textContent = `Editar Usuário: ${nome}`;
    document.getElementById('usuario_id_edicao').value = id;
    document.getElementById('novo_usuario').value = nome;
    document.getElementById('novo_papel').value = papel;
    document.getElementById('nova_senha').placeholder = "Senha (deixe vazio para manter)";
    
    document.getElementById('btnSalvarUsuario').textContent = "Salvar Alterações";
    document.getElementById('btnCancelarEdicao').style.display = "block";
    
    // Rola o formulário para cima
    const card = document.querySelector('#modalUsuarios .card');
    card.scrollIntoView({behavior: 'smooth'});
}

// Cancela edição e volta para cadastro
function cancelarEdicaoUsuario() {
    document.getElementById('tituloFormUsuario').textContent = "Adicionar Novo Usuário";
    document.getElementById('usuario_id_edicao').value = "";
    document.getElementById('novo_usuario').value = "";
    document.getElementById('nova_senha').value = "";
    document.getElementById('novo_papel').value = "tecnico";
    document.getElementById('nova_senha').placeholder = "Senha";
    
    document.getElementById('btnSalvarUsuario').textContent = "Salvar";
    document.getElementById('btnCancelarEdicao').style.display = "none";
}

// Salva usuário (Cadastrar ou Atualizar)
document.getElementById('formUsuario').addEventListener('submit', async (e) => {
    e.preventDefault();

    const idEdicao = document.getElementById('usuario_id_edicao').value;
    const dados = {
        usuario: document.getElementById('novo_usuario').value.trim(),
        senha: document.getElementById('nova_senha').value,
        papel: document.getElementById('novo_papel').value
    };

    // Se não digitar senha na edição, remove o campo para não alterar
    if (idEdicao && !dados.senha) delete dados.senha;

    try {
        let resposta;
        let mensagemSucesso;

        if (idEdicao) {
            // MODO EDIÇÃO
            resposta = await fetch(`/usuarios/${idEdicao}`, {
                method: 'PUT',
                headers: { 
                    "Content-Type": "application/json",
                    "token": localStorage.getItem("token_inventario")
                },
                body: JSON.stringify(dados)
            });
            mensagemSucesso = "✅ Usuário atualizado!";
        } else {
            // MODO CADASTRO
            resposta = await fetch('/usuarios/', {
                method: 'POST',
                headers: { 
                    "Content-Type": "application/json",
                    "token": localStorage.getItem("token_inventario")
                },
                body: JSON.stringify(dados)
            });
            mensagemSucesso = "✅ Usuário cadastrado!";
        }

        if (resposta.ok) {
            alert(mensagemSucesso);
            cancelarEdicaoUsuario(); // Limpa formulário
            carregarUsuarios(); // Atualiza a lista
        } else {
            const erro = await resposta.json();
            alert("❌ Erro: " + erro.detail);
        }

    } catch (erro) {
        console.error("Erro ao salvar usuário:", erro);
        alert("❌ Erro de conexão!");
    }
});

// Excluir usuário
async function excluirUsuario(id, nomeUsuario) {
    if (papelUsuario !== 'admin') return;

    if (confirm(`⚠️ Tem certeza que deseja excluir o usuário "${nomeUsuario}"? Essa ação não pode ser desfeita!`)) {
        try {
            const resposta = await fetch(`/usuarios/${id}`, {
                method: 'DELETE',
                headers: { "token": localStorage.getItem("token_inventario") }
            });

            if (resposta.ok) {
                alert("🗑️ Usuário removido!");
                carregarUsuarios(); // Recarrega lista
            } else {
                const erro = await resposta.json();
                alert("❌ Erro: " + erro.detail);
            }
        } catch (erro) {
            alert("Erro ao excluir!");
        }
    }
}


// =========================================================
// 10. LIGAR O MOTOR
// =========================================================
// Essa linha faz o sistema buscar os dados assim que o usuário acessa a página
carregarAtivos();