const admin = require('firebase-admin');

class PromptVersioning {
  constructor() {
    this.db = admin.firestore();
    this.collection = 'ediPromptVersions';
  }

  async saveVersion(carrierId, promptData) {
    const versionRef = this.db.collection(this.collection).doc(carrierId);
    
    const versionData = {
      currentVersion: promptData.version,
      versions: admin.firestore.FieldValue.arrayUnion({
        version: promptData.version,
        prompt: promptData.prompt,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: promptData.metadata
      }),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    await versionRef.set(versionData, { merge: true });
    return versionData;
  }

  async getVersion(carrierId, version = null) {
    const versionRef = this.db.collection(this.collection).doc(carrierId);
    const doc = await versionRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!version) {
      // Return current version
      const currentVersion = data.versions.find(v => v.version === data.currentVersion);
      return currentVersion;
    }

    // Return specific version
    return data.versions.find(v => v.version === version);
  }

  async listVersions(carrierId) {
    const versionRef = this.db.collection(this.collection).doc(carrierId);
    const doc = await versionRef.get();

    if (!doc.exists) {
      return [];
    }

    return doc.data().versions;
  }

  async rollbackToVersion(carrierId, version) {
    const versionRef = this.db.collection(this.collection).doc(carrierId);
    const doc = await versionRef.get();

    if (!doc.exists) {
      throw new Error('No versions found for carrier');
    }

    const data = doc.data();
    const targetVersion = data.versions.find(v => v.version === version);

    if (!targetVersion) {
      throw new Error('Version not found');
    }

    await versionRef.update({
      currentVersion: version,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    return targetVersion;
  }
}

module.exports = new PromptVersioning(); 