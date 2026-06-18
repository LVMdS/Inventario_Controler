// =========================================================
// 1. VARIÁVEIS GLOBAIS
// =========================================================
// Estas variáveis ficam fora das funções para que o navegador 
// não as "esqueça" e possamos usá-las em qualquer lugar do código.
let chartStatus = null;    // Guarda o gráfico de rosquinha (Status)
let chartCategoria = null; // Guarda o gráfico de barras (Categoria)


// =========================================================
// 2. FUNÇÃO PRINCIPAL: CARREGAR A TABELA (Ligar com o Banco)
// =========================================================
// Usamos 'async' porque o JavaScript precisa "esperar" (await)
// o servidor Python ir até o banco de dados e devolver a resposta.
async function carregarAtivos(busca = '') {
    // Se o usuário digitou algo na busca, adicionamos na URL. Se não, busca tudo.
    const url = busca ? `/ativos/?busca=${busca}` : '/ativos/';
    
    try {
        // Pede os dados para o Python e transforma a resposta em formato JSON
        const resposta = await fetch(url);
        const ativos = await resposta.json();
        
        // Pega a tabela no HTML e limpa ela antes de colocar os dados novos
        const tabela = document.getElementById('tabelaAtivos');
        tabela.innerHTML = ''; 
        
        // Um 'loop' (laço de repetição) que passa por cada equipamento encontrado
        ativos.forEach(ativo => {
            
            // LÓGICA DA FOTO: Se tem imagem salva, cria a tag <img>. Se não, escreve "Sem foto".
            const tagImagem = ativo.imagem 
                ? `<img src="/${ativo.imagem}" alt="Foto" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">` 
                : `<span class="text-muted small">Sem foto</span>`;
                
            // LÓGICA DO QR CODE: Se o Python gerou o QR Code, mostramos ele na tela.
            const tagQR = ativo.qr_code 
                ? `<img src="/${ativo.qr_code}" alt="QR" style="width: 50px; height: 50px; border: 1px solid #ccc; border-radius: 5px;">` 
                : `-`;

            // Escreve a linha (<tr>) e as colunas (<td>) dentro da tabela HTML
            tabela.innerHTML += `
                <tr>
                    <td>${ativo.id}</td>
                    <td>${tagImagem}</td>
                    <td>${tagQR}</td>
                    <td>${ativo.nome}</td>
                    <td>${ativo.categoria}</td>
                    <td>${ativo.fabricante}</td>
                    <td><span class="badge bg-secondary">${ativo.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="deletarAtivo(${ativo.id})">Excluir</button>
                    </td>
                </tr>
            `;
        });

        // Sempre que a tabela atualiza, mandamos atualizar o Dashboard também
        carregarDashboard();

    } catch (erro) {
        // Se a internet cair ou o servidor Python desligar, avisa no console (F12)
        console.error("Erro ao carregar a tabela:", erro);
    }
}


// =========================================================
// 3. FUNÇÃO DO DASHBOARD: GRÁFICOS E ESTATÍSTICAS
// =========================================================
async function carregarDashboard() {
    try {
        // Busca a matemática já calculada pelo Python na rota /estatisticas/
        const resposta = await fetch('/estatisticas/');
        const dados = await resposta.json();
        
        // Pega o número total e joga no quadrado azul do painel
        document.getElementById('totalAtivos').textContent = dados.total;
        
        // Prepara os dados separando as "palavras" (labels) dos "números" (valores)
        const statusLabels = Object.keys(dados.por_status);
        const statusValores = Object.values(dados.por_status);
        const categoriaLabels = Object.keys(dados.por_categoria);
        const categoriaValores = Object.values(dados.por_categoria);

        // REGRA DE OURO DOS GRÁFICOS: Destruir o antigo antes de desenhar o novo.
        // Se não fizermos isso, quando passar o mouse, o gráfico antigo "pisca" no fundo.
        if (chartStatus) chartStatus.destroy();
        if (chartCategoria) chartCategoria.destroy();

        // Desenha o gráfico de Rosquinha (Doughnut) para mostrar os Status
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

        // Desenha o gráfico de Barras (Bar) para mostrar as Categorias
        const ctxCategoria = document.getElementById('graficoCategoria').getContext('2d');
        chartCategoria = new Chart(ctxCategoria, {
            type: 'bar',
            data: {
                labels: categoriaLabels,
                datasets: [{
                    label: 'Quantidade',
                    data: categoriaValores,
                    backgroundColor: '#0d6efd' // Azul padrão do Bootstrap
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } } // Esconde a legenda do topo
            }
        });

    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);
    }
}


// =========================================================
// 4. FUNÇÃO DE CADASTRO: ENVIAR FORMULÁRIO COM IMAGEM
// =========================================================
// Ouve o evento de 'submit' (quando o usuário clica no botão verde '+')
document.getElementById('formAtivo').addEventListener('submit', async (e) => {
    e.preventDefault(); // Impede que a página dê "F5" (recarregue) sozinha
    
    // O FormData é a ferramenta oficial da web para empacotar arquivos pesados.
    // Textos simples vão como JSON, mas fotos exigem o FormData.
    const formData = new FormData();
    formData.append("nome", document.getElementById('nome').value);
    formData.append("categoria", document.getElementById('categoria').value);
    formData.append("fabricante", document.getElementById('fabricante').value);
    formData.append("status", document.getElementById('status').value);
    
    // Captura o arquivo de imagem do computador do usuário (se ele selecionou algum)
    const campoImagem = document.getElementById('imagem');
    if (campoImagem && campoImagem.files.length > 0) {
        formData.append("imagem", campoImagem.files[0]);
    }

    // Dispara o pacote de dados (textos + foto) para o Python salvar no banco
    await fetch('/ativos/', {
        method: 'POST',
        body: formData
    });

    // Limpa os campos do formulário para o próximo cadastro
    document.getElementById('formAtivo').reset(); 
    
    // Se o usuário estava com alguma busca ativa, mantém a busca ao atualizar a tabela
    const termoBusca = document.getElementById('campoBusca') ? document.getElementById('campoBusca').value : '';
    carregarAtivos(termoBusca); 
});


// =========================================================
// 5. FUNÇÃO PARA DELETAR EQUIPAMENTO
// =========================================================
async function deletarAtivo(id) {
    // Exibe um alerta de segurança antes de apagar definitivamente
    if (confirm("Tem certeza que deseja remover este equipamento? O QR code também será desativado.")) {
        // Manda o comando de DELETE para a rota específica do ID no Python
        await fetch(`/ativos/${id}`, { method: 'DELETE' });
        
        // Atualiza a tabela imediatamente após deletar
        const termoBusca = document.getElementById('campoBusca') ? document.getElementById('campoBusca').value : '';
        carregarAtivos(termoBusca);
    }
}


// =========================================================
// 6. BARRA DE BUSCA EM TEMPO REAL (FILTRO)
// =========================================================
const campoBusca = document.getElementById('campoBusca');
if (campoBusca) {
    // O evento 'input' é disparado a cada letra que o usuário digita ou apaga
    campoBusca.addEventListener('input', (e) => {
        carregarAtivos(e.target.value); // Recarrega a tabela aplicando o filtro
    });
}


// =========================================================
// 7. INICIALIZAÇÃO DO SISTEMA
// =========================================================
// Assim que o navegador termina de ler este arquivo, ele executa esta linha
// para carregar os dados do banco de dados na tela pela primeira vez.
carregarAtivos();
// =========================================================
// 8. FUNÇÃO DE AUDITORIA (LOGS)
// =========================================================
async function carregarLogs() {
    try {
        // Busca os últimos 50 logs lá no Python
        const resposta = await fetch('/logs/');
        const logs = await resposta.json();
        
        const tabelaLogs = document.getElementById('tabelaLogs');
        tabelaLogs.innerHTML = ''; // Limpa a tabela antes de escrever
        
        logs.forEach(log => {
            // Define uma cor para a "pílula" de ação dependendo do que aconteceu
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