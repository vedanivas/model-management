const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const filePath = './models/model-list.json';

const uniqueId = () => {
    const dateString = Date.now().toString(36);
    const randomness = Math.random().toString(36).substr(2);
    return dateString + randomness;
};

const unzipAndRemove = async (zipFilePath) => {
  try {
    const zip = new AdmZip(zipFilePath);

    // Extract all entries to the current directory
    zip.extractAllTo("./models");

    // Remove the original ZIP file
    await fs.promises.unlink(zipFilePath);

    console.log("Unzipped and removed the ZIP file successfully.");
  } catch (error) {
    console.error("Error unzipping or removing the file:", error);
  }
}

const removeModel = (model) => {
  fs.rmdir(`./models/${model}`, { recursive: true }, (err) => {
    if (err) {
      console.error('Error deleting model:', err);
    } else {
      console.log('Model deleted successfully.');
    }
  });
}

// Helper function to read data from the file
const readModels = () => {
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

// Helper function to write data back to the file
const writeModels = (models) => {
  fs.writeFileSync(filePath, JSON.stringify(models, null, 2));
}

// Function to add a new model
const addModel = async (newModel) => {
  const models = readModels();
  newModel.id = uniqueId();
  await unzipAndRemove("./models/" + newModel.model_dir)
  newModel.model_dir = newModel.model_dir.split('.').slice(0, -1).join('.')
  console.log("newModel", newModel)
  models.push(newModel);
  writeModels(models);
  console.log("Model added successfully.");
  return newModel;
}

// Function to edit a model by index
const editModel = (id, updatedModel) => {
  console.log("editModel", id, updatedModel)
  const models = readModels();
  let flag = false;
  let fileIndex = -1;
  models.forEach((model, index) => {
    if (model.id === id) {
      models[index].name = updatedModel.name
      models[index].description = updatedModel.description
      models[index].id = updatedModel.id
      if (updatedModel.file) {
        removeModel(model.model_dir)
        models[index].model_dir = updatedModel.file.filename
      }
      writeModels(models);
      flag = true;
      fileIndex = index
    }
  })
  if (flag) {
    console.log("Model updated successfully.");
    return models[fileIndex];
  } else {
    console.log("Model not found.");
    return {};
  }
}

// Function to delete a model by index
const deleteModel = (id) => {
  const models = readModels();
  let model_name = "";
  const updatedModels = models.filter((model) => {
    if (model.id === id) {
      model_name = model.model_dir
    }
    return model.id !== id;
  });
  removeModel(model_name)
  writeModels(models.filter((model) => model.id != id));
}

module.exports = {
    addModel,
    editModel,
    deleteModel,
    readModels,
    writeModels
}