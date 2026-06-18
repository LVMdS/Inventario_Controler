# 📦 Inventário PRO - Sistema de Gestão de Ativos de TI

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-00a393.svg)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57.svg)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952b3.svg)

Um sistema completo (Full-Stack) para gerenciamento e controle de infraestrutura de TI e equipamentos físicos. Desenvolvido para entregar segurança, rastreabilidade e facilidade de acesso no dia a dia do suporte técnico.

---

## 🚀 Recursos Principais

* **🔒 Autenticação e Segurança:** Acesso restrito por sistema de login utilizando tokens de sessão.
* **📊 Dashboard Analítico:** Painel gerencial com gráficos em tempo real (Chart.js) demonstrando volume, categorias e status dos equipamentos.
* **📱 Integração Físico/Digital (QR Code):** Geração automática de QR Codes para cada equipamento cadastrado, permitindo auditoria via smartphone.
* **📸 Catálogo Visual:** Suporte a upload de imagens reais dos ativos via `multipart/form-data`.
* **📜 Caixa Preta (Audit Logs):** Rastreamento automático e imutável de todas as ações de usuários (Login, Cadastro, Edição e Exclusão).
* **📥 Exportação de Dados:** Geração automatizada de relatórios em `.csv` (Excel) diretamente da memória do servidor.
* **💻 Interface Responsiva:** Layout "Mobile First" projetado para funcionar perfeitamente em telas de desktop e smartphones.

---

## 🛠️ Tecnologias Utilizadas

**Back-end:**
* [Python](https://www.python.org/) - Lógica de servidor
* [FastAPI](https://fastapi.tiangolo.com/) - Criação de rotas e APIs ágeis
* [SQLite](https://www.sqlite.org/) - Banco de Dados Relacional (Nativo)
* Bibliotecas Adicionais: `qrcode`, `python-multipart`

**Front-end:**
* HTML5 / CSS3 / JavaScript (Vanilla)
* [Bootstrap 5](https://getbootstrap.com/) - Estilização e componentes responsivos
* [Chart.js](https://www.chartjs.org/) - Renderização dos gráficos do Dashboard

---

## ⚙️ Como Executar o Projeto Localmente

### 1. Pré-requisitos
Certifique-se de ter o Python instalado na sua máquina. É recomendado o uso de um ambiente virtual (`venv`).

### 2. Instalação das Dependências
Abra o terminal na pasta do projeto e execute:
```bash
pip install fastapi uvicorn python-multipart qrcode[pil]

```

### 3. Iniciando o Servidor
Para rodar o sistema localmente no modo de desenvolvimento:
```bash
uvicorn main:app --reload
```
Para rodar o sistema liberado para a rede Wi-Fi local (acesso pelo celular):
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```
Para o acesso por outro disposivo pela rede local, deve-se saber o ip da maquina que estara rodando o serviço.
EX: 192.168.1.15:8000

### 4. Acessando a Aplicação
- Abra o navegador e acesse: http://127.0.0.1:8000

- Credenciais Padrão de Acesso:

Usuário: admin

Senha: admin123

### 📂 Estrutura de Arquivos:

/
├── main.py          # Cérebro do Back-end (Rotas, Banco de Dados, Segurança)
├── index.html       # Interface principal (Dashboard, Tabela, Modal de Logs)
├── login.html       # Interface de autenticação
├── script.js        # Lógica de Front-end (Fetch API, Gráficos, FormData)
├── inventario.db    # Banco de Dados SQLite (Autogerado)
├── img/             # Pasta local de armazenamento de fotos e QR Codes (Autogerada)
└── README.md        # Documentação do projeto

## 💡 Próximos Passos (Roadmap)
[ ] Adicionar sistema de permissões (níveis de administrador vs. técnico padrão).

[ ] Implementar paginação na tabela para lidar com milhares de registros.

[ ] Envio automático de alertas por e-mail para equipamentos em manutenção.

Desenvolvido como projeto prático de Arquitetura de Software e Infraestrutura.