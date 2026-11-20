# Genera un PDF de "Horarios de profesores" con el formato de Séneca y datos FICTICIOS.
# Uso: python3 pruebas/generar_horarios_ficticios.py salida.pdf  (necesita reportlab). 8 docentes inventados.
import sys, random
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4

random.seed(2026)
ANCHO, ALTO = landscape(A4)
COL = [68, 217, 366, 514, 663]
DIAS = ['Lunes', 'Martes', 'Miérc.', 'Jueves', 'Viernes']
HORAS = [('8:30', '9:30'), ('9:30', '10:30'), ('10:30', '11:30'), ('11:30', '12:00'), ('12:00', '13:00'), ('13:00', '14:00'), ('14:00', '15:00')]
DOCENTES = [
    ('PRUEBA FICTICIA,ANA', 'MAT', ['1º ESO A', '2º ESO B', '1º BACH A']),
    ('EJEMPLO INVENTADO,LUIS', 'LEN', ['1º ESO B', '3º ESO C', '2º BACH B']),
    ('DEMO SIMULADA,CARMEN', 'ING', ['2º ESO A', '4º ESO D', '1º BACH B']),
    ('MUESTRA FICTICIO,PABLO', 'GEH', ['3º ESO A', '3º ESO B', '4º ESO A']),
    ('MODELO INVENTADA,LUCÍA', 'BYG', ['1º ESO A', '1º ESO C', '3º ESO D']),
    ('ENSAYO SIMULADO,JAVIER', 'FYQ', ['2º ESO C', '4º ESO B', '1º BACH A']),
    ('PILOTO FICTICIA,ELENA', 'EF', ['1º ESO D', '2º ESO D', '4º ESO C']),
    ('BORRADOR INVENTADO,HUGO', 'TEC', ['2º ESO A', '3º ESO C', '2º BACH A']),
]
c = canvas.Canvas(sys.argv[1], pagesize=(ANCHO, ALTO))
def txt(s, x, y, tam=7, negrita=False):
    c.setFont('Helvetica-Bold' if negrita else 'Helvetica', tam)
    c.drawString(x, ALTO - y, s)
for k, (nombre, materia, grupos) in enumerate(DOCENTES):
    txt('IES Blas Infante (FICTICIO, solo para pruebas)', 39, 15, 9, True)
    txt('Horarios de profesores', 39, 30, 9)
    txt('Profesor:', 30, 64, 8, True); txt(nombre, 78, 64, 8)
    for d, x in zip(DIAS, COL):
        txt(d, x + 58, 120, 7, True)
    for i, (a, b) in enumerate(HORAS):
        txt(a, 34, 136 + i * 32); txt(b, 34, 144 + i * 32)
    # Reparto: 3 horas de guardia, 1 de recreo (la mitad), el resto clases
    huecos = [(d, h) for d in range(5) for h in range(7) if h != 3]
    random.shuffle(huecos)
    guardias, clases = huecos[:3], huecos[3:21]
    for d, h in clases:
        g = random.choice(grupos)
        aula = 'A' + str(10 + (d * 7 + h + k) % 20)
        for j, s in enumerate([materia + ' ' + g.replace('º', '').replace(' ', ''), aula, g]):
            txt(s, COL[d], 136 + h * 32 + j * 8)
    for d, h in guardias:
        txt('GUARDIA', COL[d], 136 + h * 32)
    if k % 2 == 0:
        txt('GUARDIA RECREO', COL[k % 5], 136 + 3 * 32)
    c.showPage()
c.save()
