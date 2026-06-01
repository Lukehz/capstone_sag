import sys
import json
from pathlib import Path
from ultralytics import YOLO
import cv2

def realizar_prediccion(ruta_imagen):
    # Cargar el modelo YOLOv8 (ruta robusta relativa a este archivo)
    ruta_modelo = Path(__file__).resolve().parent.parent / 'modeloYOLO' / 'best.pt'
    modelo = YOLO(str(ruta_modelo), verbose=False)

    # Realizar la predicción
    resultados = modelo(ruta_imagen, verbose=False)

    # Cargar la imagen original
    imagen = cv2.imread(ruta_imagen)

    # Extraer la información relevante de las predicciones
    detecciones = []
    for resultado in resultados:
        for box in resultado.boxes:
            clase = resultado.names[int(box.cls)]
            confianza = float(box.conf)
            (x1, y1, x2, y2) = [int(coord) for coord in box.xyxy[0]]
            detecciones.append({
                'class': clase,
                'confidence': confianza,
                'box': [x1, y1, x2, y2]
            })

    # Ordenar las detecciones por confianza en orden descendente y tomar las 2 mejores
    detecciones = sorted(detecciones, key=lambda x: x['confidence'], reverse=True)[:2]

    # Dibujar las cajas delimitadoras de las 2 mejores detecciones en la imagen
    for deteccion in detecciones:
        x1, y1, x2, y2 = deteccion['box']
        clase = deteccion['class']
        confianza = deteccion['confidence']
        cv2.rectangle(imagen, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(imagen, f'{clase} {confianza:.2f}', (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    # Guardar la imagen con las predicciones
    ruta_salida = Path(ruta_imagen).parent / f'inferencia_{Path(ruta_imagen).name}'
    cv2.imwrite(str(ruta_salida), imagen)

    # Devolver el resultado en formato JSON y la ruta de la imagen con inferencias
    return json.dumps({
        'detecciones': detecciones,
        'ruta_salida': str(ruta_salida)
    })

if __name__ == "__main__":
    ruta_imagen = sys.argv[1]
    try:
        prediccion = realizar_prediccion(ruta_imagen)
        print(prediccion)  # Solo imprime JSON
    except Exception as e:
        # En caso de error, imprime un mensaje que se pueda manejar, y devuelve JSON válido
        print(json.dumps({"error": str(e)}))