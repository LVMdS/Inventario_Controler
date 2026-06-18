from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import sqlite3
from typing import Optional
import csv
import io
import os
import shutil
import qrcode
from datetime import datetime # <- NOVA FERRAMENTA: Para pegar a data e hora do sistema

app = FastAPI()

os.makedirs("img", exist_ok=True)
app.mount("/static", StaticFiles(directory="."), name="static")
app.mount("/img", StaticFiles(directory="img"), name="img")

conexao = sqlite3.connect("inventario.db", check_same_thread=False)
cursor = conexao.cursor()

# ---------------------------------------------------------
# 1. TABELAS DO BANCO DE DADOS
# ---------------------------------------------------------
cursor.execute("""
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE,
    senha TEXT
)
""")
cursor.execute("SELECT COUNT(id) FROM usuarios")
if cursor.fetchone()[0] == 0:
    cursor.execute("INSERT INTO usuarios (usuario, senha) VALUES ('admin', 'admin123')")

cursor.execute("""
CREATE TABLE IF NOT EXISTS ativos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT, categoria TEXT, fabricante TEXT, status TEXT, imagem TEXT, qr_code TEXT 
)
""")

# NOVO: Tabela de Logs (A Caixa Preta)
cursor.execute("""
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_hora TEXT,
    acao TEXT,
    detalhes TEXT
)
""")
conexao.commit()

# ---------------------------------------------------------
# 2. FUNÇÃO ESPIÃ (Registra tudo o que acontece)
# ---------------------------------------------------------
def registrar_log(acao: str, detalhes: str):
    # Pega a data e hora de agora no formato Brasileiro
    agora = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    cursor.execute("INSERT INTO logs (data_hora, acao, detalhes) VALUES (?, ?, ?)", (agora, acao, detalhes))
    conexao.commit()

# ---------------------------------------------------------
# 3. ROTAS DO SISTEMA (Agora com a função espiã)
# ---------------------------------------------------------
@app.get("/login")
def tela_login():
    return FileResponse("login.html")

class DadosLogin(BaseModel):
    usuario: str
    senha: str

@app.post("/api/login/")
def fazer_login(dados: DadosLogin):
    cursor.execute("SELECT id FROM usuarios WHERE usuario = ? AND senha = ?", (dados.usuario, dados.senha))
    if cursor.fetchone():
        # Registra no log que alguém entrou no sistema
        registrar_log("LOGIN", f"Usuário '{dados.usuario}' acessou o sistema.")
        return {"mensagem": "Acesso Liberado", "token": "chave_mestra_secreta"}
    else:
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos")

@app.get("/")
def ler_raiz():
    return FileResponse("index.html")

@app.post("/ativos/")
def cadastrar_ativo(nome: str = Form(...), categoria: str = Form(...), fabricante: str = Form(...), status: str = Form(...), imagem: Optional[UploadFile] = File(None)):
    caminho_imagem = None
    if imagem and imagem.filename:
        caminho_imagem = f"img/{imagem.filename}"
        with open(caminho_imagem, "wb") as buffer:
            shutil.copyfileobj(imagem.file, buffer)

    cursor.execute("INSERT INTO ativos (nome, categoria, fabricante, status, imagem) VALUES (?, ?, ?, ?, ?)", (nome, categoria, fabricante, status, caminho_imagem))
    id_gerado = cursor.lastrowid 
    
    dados_qr = f"Ativo ID: {id_gerado} | {nome} | {fabricante} | Status: {status}"
    img_qr = qrcode.make(dados_qr)
    caminho_qr = f"img/qr_{id_gerado}.png"
    img_qr.save(caminho_qr)
    
    cursor.execute("UPDATE ativos SET qr_code = ? WHERE id = ?", (caminho_qr, id_gerado))
    conexao.commit()
    
    # Registra o cadastro no Log
    registrar_log("CADASTRO", f"Equipamento '{nome}' (ID: {id_gerado}) adicionado.")
    return {"mensagem": "Equipamento cadastrado com QR Code!"}

class AtivoAtualizado(BaseModel):
    nome: str
    categoria: str
    fabricante: str
    status: str

# ROTA RECUPERADA: Editar equipamento
@app.put("/ativos/{ativo_id}")
def atualizar_ativo(ativo_id: int, ativo: AtivoAtualizado):
    cursor.execute(
        "UPDATE ativos SET nome = ?, categoria = ?, fabricante = ?, status = ? WHERE id = ?",
        (ativo.nome, ativo.categoria, ativo.fabricante, ativo.status, ativo_id)
    )
    conexao.commit()
    # Registra a edição no Log
    registrar_log("EDIÇÃO", f"Equipamento ID {ativo_id} modificado para Status: {ativo.status}.")
    return {"mensagem": "Equipamento atualizado!"}

@app.get("/ativos/")
def listar_ativos(busca: Optional[str] = None):
    if busca:
        texto_busca = f"%{busca}%"
        cursor.execute("SELECT id, nome, categoria, fabricante, status, imagem, qr_code FROM ativos WHERE nome LIKE ? OR categoria LIKE ? OR fabricante LIKE ?", (texto_busca, texto_busca, texto_busca))
    else:
        cursor.execute("SELECT id, nome, categoria, fabricante, status, imagem, qr_code FROM ativos")
        
    resultados = cursor.fetchall()
    return [{"id": l[0], "nome": l[1], "categoria": l[2], "fabricante": l[3], "status": l[4], "imagem": l[5], "qr_code": l[6]} for l in resultados]

@app.delete("/ativos/{ativo_id}")
def deletar_ativo(ativo_id: int):
    # Antes de apagar, busca o nome da máquina para salvar no log
    cursor.execute("SELECT nome FROM ativos WHERE id = ?", (ativo_id,))
    nome = cursor.fetchone()[0]
    
    cursor.execute("DELETE FROM ativos WHERE id = ?", (ativo_id,))
    conexao.commit()
    
    # Registra a exclusão no Log
    registrar_log("EXCLUSÃO", f"Equipamento '{nome}' (ID: {ativo_id}) removido do sistema.")
    return {"mensagem": "Equipamento removido!"}

# NOVO: Rota para buscar os logs e mostrar na tela
@app.get("/logs/")
def listar_logs():
    # ORDER BY id DESC faz os logs mais novos aparecerem no topo da lista
    cursor.execute("SELECT data_hora, acao, detalhes FROM logs ORDER BY id DESC LIMIT 50")
    resultados = cursor.fetchall()
    return [{"data_hora": l[0], "acao": l[1], "detalhes": l[2]} for l in resultados]

@app.get("/estatisticas/")
def obter_estatisticas():
    cursor.execute("SELECT COUNT(id) FROM ativos")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT status, COUNT(id) FROM ativos GROUP BY status")
    por_status = {linha[0]: linha[1] for linha in cursor.fetchall()}
    cursor.execute("SELECT categoria, COUNT(id) FROM ativos GROUP BY categoria")
    por_categoria = {linha[0]: linha[1] for linha in cursor.fetchall()}
    return {"total": total, "por_status": por_status, "por_categoria": por_categoria}

@app.get("/exportar-csv/")
def exportar_csv():
    cursor.execute("SELECT id, nome, categoria, fabricante, status, imagem, qr_code FROM ativos")
    resultados = cursor.fetchall()
    stream = io.StringIO()
    escritor = csv.writer(stream, delimiter=';') 
    escritor.writerow(["ID", "Nome", "Categoria", "Fabricante", "Status", "Caminho Imagem", "Caminho QR Code"])
    for linha in resultados:
        escritor.writerow(linha)
    return Response(content=stream.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=relatorio_inventario.csv"})