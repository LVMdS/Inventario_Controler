from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
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
from datetime import datetime

app = FastAPI()

os.makedirs("img", exist_ok=True)
app.mount("/static", StaticFiles(directory="."), name="static")
app.mount("/img", StaticFiles(directory="img"), name="img")

conexao = sqlite3.connect("inventario.db", check_same_thread=False)
cursor = conexao.cursor()

# ---------------------------------------------------------
# 1. TABELA DE USUÁRIOS
# ---------------------------------------------------------
cursor.execute("""
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE,
    senha TEXT,
    papel TEXT 
)
""")

cursor.execute("SELECT COUNT(id) FROM usuarios")
if cursor.fetchone()[0] == 0:
    cursor.execute("INSERT INTO usuarios (usuario, senha, papel) VALUES ('admin', 'admin123', 'admin')")
    cursor.execute("INSERT INTO usuarios (usuario, senha, papel) VALUES ('tecnico', 'tecnico123', 'tecnico')")
conexao.commit() 

# ---------------------------------------------------------
# 2. TABELA DE ATIVOS
# ---------------------------------------------------------
cursor.execute("""
CREATE TABLE IF NOT EXISTS ativos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT, categoria TEXT, fabricante TEXT, status TEXT, imagem TEXT, qr_code TEXT 
)
""")
conexao.commit()

# ---------------------------------------------------------
# 3. TABELA DE LOGS
# ---------------------------------------------------------
cursor.execute("""
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_hora TEXT,
    acao TEXT,
    detalhes TEXT
)
""")
conexao.commit()

def registrar_log(acao: str, detalhes: str):
    agora = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    cursor.execute("INSERT INTO logs (data_hora, acao, detalhes) VALUES (?, ?, ?)", (agora, acao, detalhes))
    conexao.commit()

# ---------------------------------------------------------
# FUNÇÃO AUXILIAR DE SEGURANÇA
# ---------------------------------------------------------
def verificar_permissao_admin(token: str = Header(None)):
    if token != "chave_mestra_secreta":
        raise HTTPException(status_code=403, detail="Acesso negado: Apenas administradores")
    return True

# ---------------------------------------------------------
# MODELOS DE DADOS
# ---------------------------------------------------------
class DadosLogin(BaseModel):
    usuario: str
    senha: str

class AtivoAtualizado(BaseModel):
    nome: str
    categoria: str
    fabricante: str
    status: str

class UsuarioModel(BaseModel):
    usuario: str
    senha: str
    papel: str

class UsuarioAtualizado(BaseModel):
    usuario: Optional[str] = None
    senha: Optional[str] = None
    papel: Optional[str] = None

# ---------------------------------------------------------
# ROTAS DO SISTEMA
# ---------------------------------------------------------
@app.get("/login")
def tela_login():
    return FileResponse("login.html")

@app.post("/api/login/")
def fazer_login(dados: DadosLogin):
    cursor.execute("SELECT id, papel FROM usuarios WHERE usuario = ? AND senha = ?", (dados.usuario, dados.senha))
    usuario_valido = cursor.fetchone()
    
    if usuario_valido:
        registrar_log("LOGIN", f"Usuário '{dados.usuario}' acessou o sistema.")
        return {"mensagem": "Acesso Liberado", "token": "chave_mestra_secreta", "papel": usuario_valido[1]}
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
    
    registrar_log("CADASTRO", f"Equipamento '{nome}' (ID: {id_gerado}) adicionado.")
    return {"mensagem": "Equipamento cadastrado com QR Code!"}

@app.put("/ativos/{ativo_id}")
def atualizar_ativo(ativo_id: int, ativo: AtivoAtualizado):
    cursor.execute("UPDATE ativos SET nome = ?, categoria = ?, fabricante = ?, status = ? WHERE id = ?", (ativo.nome, ativo.categoria, ativo.fabricante, ativo.status, ativo_id))
    conexao.commit()
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
    cursor.execute("SELECT nome FROM ativos WHERE id = ?", (ativo_id,))
    nome = cursor.fetchone()[0]
    cursor.execute("DELETE FROM ativos WHERE id = ?", (ativo_id,))
    conexao.commit()
    registrar_log("EXCLUSÃO", f"Equipamento '{nome}' (ID: {ativo_id}) removido do sistema.")
    return {"mensagem": "Equipamento removido!"}

@app.get("/logs/")
def listar_logs():
    cursor.execute("SELECT data_hora, acao, detalhes FROM logs ORDER BY id DESC LIMIT 50")
    return [{"data_hora": l[0], "acao": l[1], "detalhes": l[2]} for l in cursor.fetchall()]

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


# =========================================================
# ROTAS: GERENCIAMENTO DE USUÁRIOS (COMPLETO)
# =========================================================

# Listar todos os usuários
@app.get("/usuarios/")
def listar_usuarios(token: str = Header(None)):
    verificar_permissao_admin(token)
    cursor.execute("SELECT id, usuario, papel FROM usuarios ORDER BY usuario ASC")
    resultados = cursor.fetchall()
    return [{"id": u[0], "usuario": u[1], "papel": u[2]} for u in resultados]

# Cadastrar novo usuário
@app.post("/usuarios/")
def criar_usuario(usuario: UsuarioModel, token: str = Header(None)):
    verificar_permissao_admin(token)
    try:
        cursor.execute("INSERT INTO usuarios (usuario, senha, papel) VALUES (?, ?, ?)", 
                       (usuario.usuario, usuario.senha, usuario.papel))
        conexao.commit()
        registrar_log("CADASTRO USUÁRIO", f"Novo usuário '{usuario.usuario}' criado como {usuario.papel}")
        return {"mensagem": "Usuário cadastrado com sucesso!"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Nome de usuário já existe!")

# Atualizar usuário
@app.put("/usuarios/{usuario_id}")
def atualizar_usuario(usuario_id: int, usuario: UsuarioAtualizado, token: str = Header(None)):
    verificar_permissao_admin(token)
    
    # Não permitir alterar o admin principal
    cursor.execute("SELECT usuario FROM usuarios WHERE id = ?", (usuario_id,))
    usuario_atual = cursor.fetchone()
    if not usuario_atual:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if usuario_atual[0] == "admin" and usuario.usuario and usuario.usuario != "admin":
        raise HTTPException(status_code=403, detail="Não é permitido alterar o nome do usuário administrador padrão!")

    # Pegar dados atuais para manter o que não foi alterado
    cursor.execute("SELECT usuario, senha, papel FROM usuarios WHERE id = ?", (usuario_id,))
    atual = cursor.fetchone()

    novo_usuario = usuario.usuario or atual[0]
    nova_senha = usuario.senha or atual[1]
    novo_papel = usuario.papel or atual[2]

    try:
        cursor.execute("UPDATE usuarios SET usuario = ?, senha = ?, papel = ? WHERE id = ?", 
                       (novo_usuario, nova_senha, novo_papel, usuario_id))
        conexao.commit()
        registrar_log("EDIÇÃO USUÁRIO", f"Usuário ID {usuario_id} ('{novo_usuario}') foi alterado.")
        return {"mensagem": "Usuário atualizado!"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Nome de usuário já existe!")

# Excluir usuário
@app.delete("/usuarios/{usuario_id}")
def deletar_usuario(usuario_id: int, token: str = Header(None)):
    verificar_permissao_admin(token)
    
    # Não permitir excluir o próprio admin principal
    cursor.execute("SELECT usuario FROM usuarios WHERE id = ?", (usuario_id,))
    nome = cursor.fetchone()
    if not nome:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if nome[0] == "admin":
        raise HTTPException(status_code=403, detail="Não é permitido excluir o usuário administrador padrão!")

    cursor.execute("DELETE FROM usuarios WHERE id = ?", (usuario_id,))
    conexao.commit()
    registrar_log("EXCLUSÃO USUÁRIO", f"Usuário '{nome[0]}' (ID: {usuario_id}) removido.")
    return {"mensagem": "Usuário removido!"}