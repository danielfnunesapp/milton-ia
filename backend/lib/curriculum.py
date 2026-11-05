"""Currículo Paulista (SEDUC-SP) / BNCC — trilhas por série, disciplina e bimestre.

Cada entrada: (unidade temática, habilidade, objeto de conhecimento) — uma por bimestre,
seguindo a progressão do Currículo Priorizado.
"""

import re
import unicodedata

GRADES = [
    ("6EF", "6º Ano", "Ensino Fundamental"),
    ("7EF", "7º Ano", "Ensino Fundamental"),
    ("8EF", "8º Ano", "Ensino Fundamental"),
    ("9EF", "9º Ano", "Ensino Fundamental"),
    ("1EM", "1ª Série", "Ensino Médio"),
    ("2EM", "2ª Série", "Ensino Médio"),
    ("3EM", "3ª Série", "Ensino Médio"),
]
GRADE_LABEL = {code: f"{label} — {level}" for code, label, level in GRADES}

EF_SUBJECTS = ["Língua Portuguesa", "Matemática", "Ciências", "História", "Geografia", "Arte", "Inglês"]
EM_SUBJECTS = ["Língua Portuguesa", "Matemática", "Física", "Química", "Biologia", "História",
               "Geografia", "Filosofia", "Sociologia", "Inglês"]
SCIENCE_SUBJECTS = {"Ciências", "Física", "Química", "Biologia", "Ciências da Natureza"}

C = {
    "6EF": {
        "Língua Portuguesa": [("Leitura", "EF67LP28", "Leitura de narrativas de aventura e contos"), ("Produção de textos", "EF06LP11", "Coesão e uso de conectivos"), ("Análise linguística", "EF06LP04", "Classes de palavras: substantivo e adjetivo"), ("Oralidade", "EF69LP13", "Debate e argumentação oral")],
        "Matemática": [("Números", "EF06MA01", "Sistema de numeração decimal e números naturais"), ("Números", "EF06MA07", "Frações: significados e equivalência"), ("Geometria", "EF06MA18", "Polígonos: classificação e elementos"), ("Probabilidade e estatística", "EF06MA32", "Leitura e interpretação de tabelas e gráficos")],
        "Ciências": [("Matéria e energia", "EF06CI01", "Misturas homogêneas e heterogêneas"), ("Matéria e energia", "EF06CI03", "Separação de materiais"), ("Vida e evolução", "EF06CI05", "Célula como unidade da vida"), ("Terra e Universo", "EF06CI11", "Camadas da Terra")],
        "História": [("Tempo e registros", "EF06HI01", "Tempo histórico e cronologia"), ("Origens da humanidade", "EF06HI03", "Teorias sobre a origem do ser humano"), ("Antiguidade", "EF06HI07", "Egito e Mesopotâmia"), ("Antiguidade Clássica", "EF06HI10", "Grécia e Roma: cidadania e política")],
        "Geografia": [("O sujeito e seu lugar no mundo", "EF06GE01", "Paisagem e transformação do lugar"), ("Formas de representação", "EF06GE08", "Escalas e mapas"), ("Natureza e qualidade de vida", "EF06GE05", "Relevo, solo e hidrografia"), ("Conexões e escalas", "EF06GE03", "Movimentos da Terra e clima")],
        "Arte": [("Artes visuais", "EF69AR01", "Elementos da linguagem visual"), ("Música", "EF69AR16", "Ritmo e melodia"), ("Teatro", "EF69AR24", "Jogos teatrais e improvisação"), ("Dança", "EF69AR09", "Corpo e movimento na dança")],
        "Inglês": [("Oralidade", "EF06LI01", "Apresentações pessoais"), ("Leitura", "EF06LI07", "Cognatos e skimming"), ("Conhecimentos linguísticos", "EF06LI18", "Verb to be e pronomes"), ("Dimensão intercultural", "EF06LI24", "A língua inglesa no mundo")],
    },
    "7EF": {
        "Língua Portuguesa": [("Leitura", "EF07LP01", "Notícia e reportagem"), ("Análise linguística", "EF07LP04", "Sujeito e predicado"), ("Produção de textos", "EF07LP09", "Texto de opinião"), ("Análise linguística", "EF07LP06", "Concordância verbal e nominal")],
        "Matemática": [("Números", "EF07MA03", "Números inteiros e operações"), ("Álgebra", "EF07MA13", "Linguagem algébrica e expressões"), ("Álgebra", "EF07MA18", "Equações do 1º grau"), ("Grandezas e medidas", "EF07MA31", "Área de triângulos e quadriláteros")],
        "Ciências": [("Matéria e energia", "EF07CI01", "Máquinas simples"), ("Matéria e energia", "EF07CI02", "Calor e temperatura"), ("Vida e evolução", "EF07CI07", "Ecossistemas brasileiros"), ("Terra e Universo", "EF07CI12", "Composição do ar e efeito estufa")],
        "História": [("O mundo moderno", "EF07HI02", "Renascimento e Humanismo"), ("Reformas religiosas", "EF07HI05", "Reforma e Contrarreforma"), ("Navegações", "EF07HI06", "Grandes navegações e conquista da América"), ("Brasil colonial", "EF07HI12", "Economia açucareira e escravidão")],
        "Geografia": [("O sujeito e seu lugar no mundo", "EF07GE01", "Formação territorial do Brasil"), ("Conexões e escalas", "EF07GE04", "Distribuição da população brasileira"), ("Mundo do trabalho", "EF07GE06", "Produção e circulação de mercadorias"), ("Natureza e qualidade de vida", "EF07GE11", "Biomas brasileiros")],
        "Arte": [("Artes visuais", "EF69AR02", "Arte urbana e grafite"), ("Música", "EF69AR19", "Gêneros musicais brasileiros"), ("Teatro", "EF69AR27", "Criação de cenas"), ("Artes integradas", "EF69AR31", "Patrimônio cultural")],
        "Inglês": [("Oralidade", "EF07LI01", "Conversas sobre rotina"), ("Leitura", "EF07LI07", "Textos narrativos"), ("Conhecimentos linguísticos", "EF07LI20", "Simple past"), ("Dimensão intercultural", "EF07LI22", "Variação linguística do inglês")],
    },
    "8EF": {
        "Língua Portuguesa": [("Leitura", "EF08LP01", "Artigo de opinião e argumentação"), ("Produção de textos", "EF08LP03", "Produção de artigo de opinião"), ("Análise linguística", "EF08LP06", "Termos da oração: complementos verbais"), ("Análise linguística", "EF08LP13", "Coesão sequencial e conjunções")],
        "Matemática": [("Números", "EF08MA01", "Potenciação e notação científica"), ("Números", "EF08MA02", "Radiciação"), ("Álgebra", "EF08MA08", "Sistemas de equações do 1º grau"), ("Probabilidade e estatística", "EF08MA22", "Princípio multiplicativo e probabilidade")],
        "Ciências": [("Matéria e energia", "EF08CI01", "Fontes e tipos de energia"), ("Matéria e energia", "EF08CI04", "Circuitos elétricos e consumo"), ("Vida e evolução", "EF08CI08", "Sistema reprodutor e puberdade"), ("Terra e Universo", "EF08CI12", "Fases da Lua e eclipses")],
        "História": [("Iluminismo", "EF08HI01", "Iluminismo e liberalismo"), ("Revoluções", "EF08HI04", "Revolução Francesa"), ("Independências", "EF08HI07", "Independência do Brasil"), ("Brasil Império", "EF08HI15", "Segundo Reinado")],
        "Geografia": [("O sujeito e seu lugar no mundo", "EF08GE01", "Fluxos migratórios"), ("Mundo do trabalho", "EF08GE13", "Industrialização na América Latina"), ("Formas de representação", "EF08GE18", "Mapas temáticos da América e África"), ("Natureza e qualidade de vida", "EF08GE23", "Recursos naturais da América e África")],
        "Arte": [("Artes visuais", "EF69AR04", "Fotografia e imagem digital"), ("Música", "EF69AR20", "Notação musical"), ("Dança", "EF69AR12", "Danças populares brasileiras"), ("Artes integradas", "EF69AR35", "Arte e tecnologia")],
        "Inglês": [("Oralidade", "EF08LI01", "Negociação de sentidos"), ("Leitura", "EF08LI05", "Textos informativos"), ("Conhecimentos linguísticos", "EF08LI14", "Futuro: will e going to"), ("Dimensão intercultural", "EF08LI19", "Manifestações culturais")],
    },
    "9EF": {
        "Língua Portuguesa": [("Leitura", "EF09LP01", "Fake news e checagem de fatos"), ("Análise linguística", "EF09LP08", "Orações subordinadas"), ("Produção de textos", "EF89LP10", "Resenha crítica"), ("Leitura", "EF89LP33", "Leitura literária: contos e crônicas")],
        "Matemática": [("Números", "EF09MA02", "Números reais e irracionais"), ("Álgebra", "EF09MA09", "Equações do 2º grau"), ("Álgebra", "EF09MA06", "Funções: noções e representações"), ("Geometria", "EF09MA13", "Teorema de Pitágoras")],
        "Ciências": [("Matéria e energia", "EF09CI03", "Estrutura da matéria e modelos atômicos"), ("Matéria e energia", "EF09CI02", "Transformações químicas"), ("Vida e evolução", "EF09CI08", "Hereditariedade e genética"), ("Terra e Universo", "EF09CI14", "Composição do Sistema Solar")],
        "História": [("República", "EF09HI01", "Primeira República"), ("Era Vargas", "EF09HI06", "Era Vargas"), ("Totalitarismos", "EF09HI13", "Primeira e Segunda Guerra Mundial"), ("Ditadura e redemocratização", "EF09HI19", "Ditadura civil-militar no Brasil")],
        "Geografia": [("O sujeito e seu lugar no mundo", "EF09GE01", "Hegemonia europeia e globalização"), ("Conexões e escalas", "EF09GE05", "Integração mundial e blocos econômicos"), ("Mundo do trabalho", "EF09GE10", "Transformações do trabalho"), ("Natureza e qualidade de vida", "EF09GE17", "Europa, Ásia e Oceania: aspectos físicos")],
        "Arte": [("Artes visuais", "EF69AR05", "Arte contemporânea"), ("Música", "EF69AR22", "Música e mídias"), ("Teatro", "EF69AR29", "Montagem teatral"), ("Artes integradas", "EF69AR33", "Cultura afro-brasileira e indígena")],
        "Inglês": [("Oralidade", "EF09LI01", "Debates e argumentação"), ("Leitura", "EF09LI05", "Textos argumentativos"), ("Conhecimentos linguísticos", "EF09LI16", "Orações condicionais (if clauses)"), ("Dimensão intercultural", "EF09LI17", "Inglês como língua global")],
    },
    "1EM": {
        "Língua Portuguesa": [("Leitura", "EM13LP01", "Gêneros textuais e intertextualidade"), ("Literatura", "EM13LP52", "Trovadorismo, Humanismo e Classicismo"), ("Análise linguística", "EM13LP06", "Variação linguística"), ("Produção de textos", "EM13LP15", "Texto dissertativo-argumentativo")],
        "Matemática": [("Números e álgebra", "EM13MAT101", "Conjuntos e funções"), ("Números e álgebra", "EM13MAT302", "Função afim"), ("Números e álgebra", "EM13MAT402", "Função quadrática"), ("Números e álgebra", "EM13MAT304", "Função exponencial")],
        "Física": [("Matéria e energia", "EM13CNT204", "Cinemática: movimento uniforme"), ("Matéria e energia", "EM13CNT204", "Leis de Newton"), ("Matéria e energia", "EM13CNT101", "Trabalho, energia e potência"), ("Matéria e energia", "EM13CNT101", "Conservação de energia")],
        "Química": [("Matéria e energia", "EM13CNT307", "Modelos atômicos"), ("Matéria e energia", "EM13CNT307", "Tabela periódica"), ("Matéria e energia", "EM13CNT307", "Ligações químicas"), ("Matéria e energia", "EM13CNT101", "Reações e balanceamento")],
        "Biologia": [("Vida, Terra e Cosmos", "EM13CNT202", "Origem da vida"), ("Vida, Terra e Cosmos", "EM13CNT202", "Citologia"), ("Vida, Terra e Cosmos", "EM13CNT206", "Ecologia e cadeias alimentares"), ("Vida, Terra e Cosmos", "EM13CNT207", "Saúde e metabolismo")],
        "História": [("Tempo e espaço", "EM13CHS101", "Pré-história e primeiras civilizações"), ("Política e trabalho", "EM13CHS603", "Grécia e Roma"), ("Territórios e fronteiras", "EM13CHS204", "Idade Média e feudalismo"), ("Indivíduo, sociedade e cultura", "EM13CHS102", "Povos indígenas e africanos")],
        "Geografia": [("Natureza e sociedade", "EM13CHS106", "Cartografia e geotecnologias"), ("Natureza e sociedade", "EM13CHS301", "Geologia e relevo"), ("Natureza e sociedade", "EM13CHS304", "Clima e mudanças climáticas"), ("Natureza e sociedade", "EM13CHS306", "Recursos hídricos")],
        "Filosofia": [("Indivíduo, sociedade e cultura", "EM13CHS101", "Mito e origem da filosofia"), ("Ética", "EM13CHS501", "Pré-socráticos e Sócrates"), ("Conhecimento", "EM13CHS103", "Platão e Aristóteles"), ("Ética", "EM13CHS502", "Ética e moral")],
        "Sociologia": [("Indivíduo, sociedade e cultura", "EM13CHS101", "O que é Sociologia"), ("Indivíduo, sociedade e cultura", "EM13CHS102", "Cultura e identidade"), ("Política e trabalho", "EM13CHS401", "Trabalho e sociedade"), ("Indivíduo, sociedade e cultura", "EM13CHS502", "Desigualdades sociais")],
        "Inglês": [("Leitura", "EM13LGG403", "Reading strategies"), ("Conhecimentos linguísticos", "EM13LGG403", "Present perfect"), ("Leitura", "EM13LGG402", "Gêneros digitais em inglês"), ("Dimensão intercultural", "EM13LGG401", "Inglês e cultura global")],
    },
    "2EM": {
        "Língua Portuguesa": [("Literatura", "EM13LP48", "Barroco e Arcadismo"), ("Literatura", "EM13LP49", "Romantismo"), ("Literatura", "EM13LP50", "Realismo e Naturalismo"), ("Produção de textos", "EM13LP05", "Argumentação e contra-argumentação")],
        "Matemática": [("Geometria e medidas", "EM13MAT308", "Trigonometria no triângulo retângulo"), ("Números e álgebra", "EM13MAT315", "Matrizes e sistemas lineares"), ("Probabilidade e estatística", "EM13MAT310", "Análise combinatória"), ("Probabilidade e estatística", "EM13MAT311", "Probabilidade")],
        "Física": [("Matéria e energia", "EM13CNT102", "Termologia e calorimetria"), ("Matéria e energia", "EM13CNT102", "Termodinâmica"), ("Matéria e energia", "EM13CNT103", "Ondulatória e som"), ("Matéria e energia", "EM13CNT103", "Óptica geométrica")],
        "Química": [("Matéria e energia", "EM13CNT307", "Soluções e concentração"), ("Matéria e energia", "EM13CNT101", "Termoquímica"), ("Matéria e energia", "EM13CNT101", "Cinética química"), ("Matéria e energia", "EM13CNT101", "Equilíbrio químico")],
        "Biologia": [("Vida, Terra e Cosmos", "EM13CNT202", "Classificação dos seres vivos"), ("Vida, Terra e Cosmos", "EM13CNT202", "Botânica"), ("Vida, Terra e Cosmos", "EM13CNT202", "Zoologia"), ("Vida, Terra e Cosmos", "EM13CNT207", "Fisiologia humana")],
        "História": [("Territórios e fronteiras", "EM13CHS201", "Expansão marítima e colonização"), ("Política e trabalho", "EM13CHS603", "Absolutismo e Iluminismo"), ("Política e trabalho", "EM13CHS401", "Revolução Industrial"), ("Política e trabalho", "EM13CHS603", "Brasil Império")],
        "Geografia": [("Política e trabalho", "EM13CHS402", "Industrialização e espaço"), ("Territórios e fronteiras", "EM13CHS201", "Urbanização"), ("Territórios e fronteiras", "EM13CHS203", "População e migrações"), ("Política e trabalho", "EM13CHS302", "Agropecuária e agronegócio")],
        "Filosofia": [("Conhecimento", "EM13CHS103", "Filosofia medieval"), ("Conhecimento", "EM13CHS103", "Racionalismo e empirismo"), ("Ética", "EM13CHS501", "Kant e a ética do dever"), ("Política", "EM13CHS603", "Contratualistas: Hobbes, Locke e Rousseau")],
        "Sociologia": [("Política e trabalho", "EM13CHS603", "Poder, Estado e democracia"), ("Indivíduo, sociedade e cultura", "EM13CHS502", "Movimentos sociais"), ("Indivíduo, sociedade e cultura", "EM13CHS503", "Violência e cidadania"), ("Política e trabalho", "EM13CHS606", "Direitos humanos")],
        "Inglês": [("Leitura", "EM13LGG403", "Textos jornalísticos"), ("Conhecimentos linguísticos", "EM13LGG403", "Passive voice"), ("Oralidade", "EM13LGG401", "Apresentações orais"), ("Leitura", "EM13LGG402", "Letras de músicas e poemas")],
    },
    "3EM": {
        "Língua Portuguesa": [("Literatura", "EM13LP51", "Modernismo brasileiro"), ("Literatura", "EM13LP52", "Literatura contemporânea"), ("Análise linguística", "EM13LP02", "Coesão e coerência"), ("Produção de textos", "EM13LP15", "Redação modelo ENEM")],
        "Matemática": [("Geometria e medidas", "EM13MAT201", "Geometria espacial: prismas e cilindros"), ("Geometria e medidas", "EM13MAT309", "Geometria analítica"), ("Probabilidade e estatística", "EM13MAT316", "Média, moda e mediana"), ("Números e álgebra", "EM13MAT303", "Matemática financeira: juros")],
        "Física": [("Matéria e energia", "EM13CNT106", "Eletrostática"), ("Matéria e energia", "EM13CNT107", "Eletrodinâmica e circuitos"), ("Matéria e energia", "EM13CNT308", "Eletromagnetismo"), ("Vida, Terra e Cosmos", "EM13CNT209", "Física moderna")],
        "Química": [("Matéria e energia", "EM13CNT307", "Cadeias carbônicas"), ("Matéria e energia", "EM13CNT307", "Funções orgânicas"), ("Matéria e energia", "EM13CNT309", "Polímeros"), ("Matéria e energia", "EM13CNT206", "Química ambiental")],
        "Biologia": [("Vida, Terra e Cosmos", "EM13CNT205", "Genética mendeliana"), ("Vida, Terra e Cosmos", "EM13CNT304", "Biotecnologia"), ("Vida, Terra e Cosmos", "EM13CNT208", "Evolução"), ("Vida, Terra e Cosmos", "EM13CNT206", "Ecologia e sustentabilidade")],
        "História": [("Política e trabalho", "EM13CHS603", "República no Brasil"), ("Territórios e fronteiras", "EM13CHS204", "Guerras Mundiais"), ("Política e trabalho", "EM13CHS603", "Guerra Fria"), ("Política e trabalho", "EM13CHS605", "Ditadura e Nova República")],
        "Geografia": [("Territórios e fronteiras", "EM13CHS204", "Geopolítica mundial"), ("Política e trabalho", "EM13CHS202", "Globalização"), ("Natureza e sociedade", "EM13CHS302", "Fontes de energia"), ("Natureza e sociedade", "EM13CHS306", "Questões ambientais globais")],
        "Filosofia": [("Ética", "EM13CHS501", "Existencialismo"), ("Política", "EM13CHS603", "Filosofia política contemporânea"), ("Conhecimento", "EM13CHS103", "Filosofia da ciência"), ("Ética", "EM13CHS504", "Ética e tecnologia")],
        "Sociologia": [("Indivíduo, sociedade e cultura", "EM13CHS403", "Indústria cultural e mídia"), ("Política e trabalho", "EM13CHS404", "Trabalho na era digital"), ("Indivíduo, sociedade e cultura", "EM13CHS502", "Questões étnico-raciais"), ("Indivíduo, sociedade e cultura", "EM13CHS503", "Juventude e projeto de vida")],
        "Inglês": [("Leitura", "EM13LGG403", "Interpretação de textos estilo ENEM"), ("Conhecimentos linguísticos", "EM13LGG403", "Reported speech"), ("Leitura", "EM13LGG402", "Gêneros argumentativos"), ("Dimensão intercultural", "EM13LGG401", "Inglês no mercado de trabalho")],
    },
}

ENEM_AREAS = {
    "linguagens": "Linguagens, Códigos e suas Tecnologias",
    "matematica": "Matemática e suas Tecnologias",
    "natureza": "Ciências da Natureza e suas Tecnologias",
    "humanas": "Ciências Humanas e suas Tecnologias",
}


def slug(text: str) -> str:
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def subjects_for(grade: str) -> list[str]:
    return EM_SUBJECTS if grade.endswith("EM") else EF_SUBJECTS


def topics_for(grade: str, subject: str) -> list[dict]:
    rows = C.get(grade, {}).get(subject, [])
    return [
        {"id": f"{grade}-{slug(subject)}-b{i + 1}", "bimestre": i + 1, "unidade": u, "habilidade": h, "objeto": o}
        for i, (u, h, o) in enumerate(rows)
    ]


def find_topic(topic_id: str) -> dict | None:
    grade = topic_id.split("-")[0]
    for subject in subjects_for(grade):
        for t in topics_for(grade, subject):
            if t["id"] == topic_id:
                return {**t, "grade": grade, "subject": subject}
    return None
