// Código para Google Apps Script (extensions -> Apps Script)

// Se ejecuta cuando el servidor envía un JSON para guardar la partida (POST)
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    var correo = data.correo;
    var nombrePartida = data.nombre_partida;
    var estado = data.estado; // Todo el JSON del juego
    var fecha = new Date();
    
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var rowUpdated = false;
    
    // Buscar si ya existe una partida con ese correo y nombre para actualizarla
    for (var i = 1; i < values.length; i++) {
      if (values[i][1] == correo && values[i][2] == nombrePartida) {
        // Actualizar el estado y la fecha en la fila existente
        sheet.getRange(i + 1, 4).setValue(estado);
        sheet.getRange(i + 1, 5).setValue(fecha);
        rowUpdated = true;
        break;
      }
    }
    
    // Si no existe, insertar nueva fila
    if (!rowUpdated) {
      // Columnas: id, correo, nombre_partida, estado, fecha
      var newId = Utilities.getUuid();
      sheet.appendRow([newId, correo, nombrePartida, estado, fecha]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Partida guardada"}))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// Se ejecuta cuando el servidor pide las partidas guardadas (GET)
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var correo = e.parameter.correo;
    var nombrePartida = e.parameter.nombre_partida;
    
    if (!correo) {
      return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Falta parametro correo"}))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    
    var resultados = [];
    
    // Buscar todas las partidas asociadas a ese correo
    for (var i = 1; i < values.length; i++) {
      if (values[i][1] == correo) {
        // Si especificó nombre_partida, filtramos, si no, devolvemos todas las suyas
        if (!nombrePartida || values[i][2] == nombrePartida) {
           resultados.push({
             "id": values[i][0],
             "correo": values[i][1],
             "nombre_partida": values[i][2],
             "estado": values[i][3], // JSON guardado
             "fecha": values[i][4]
           });
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success", "data": resultados}))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
