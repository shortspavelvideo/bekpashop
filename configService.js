import * as configcat from 'configcat-node';

const configCatClient = configcat.getClient('configcat-sdk-1/b7DcCO0dFEmCsj9M9cc77g/ZC8lKGaYRU-xHAfjXeEFQQ');

export async function isFeatureEnabled(featureKey) {
    try {
        const enabled = await configCatClient.getValueAsync(featureKey, false);
        return enabled;
    } catch (error) {
        console.error('Chyba při načítání feature flagu:', error);
        return false; // Výchozí hodnota v případě chyby
    }
}