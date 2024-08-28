//tests/configService.test.js//
const configcat = require('configcat-node');
const { isFeatureEnabled } = require('../configService');

jest.mock('configcat-node', () => {
    return {
        createClient: jest.fn().mockReturnValue({
            getValueAsync: jest.fn()
        }),
        createConsoleLogger: jest.fn(),
        LogLevel: {
            Info: 3 // '3' is the numerical value for 'Info' log level in ConfigCat
        }
    };
});

describe('Config Service', () => {
    let mockClient;

    beforeEach(() => {
        mockClient = configcat.createClient();
    });

    it('should return true if feature is enabled', async () => {
        mockClient.getValueAsync.mockResolvedValue(true);

        const result = await isFeatureEnabled('testFeature');
        expect(result).toBe(true);
        expect(mockClient.getValueAsync).toHaveBeenCalledWith('testFeature', false);
    });

    it('should return false if feature is disabled', async () => {
        mockClient.getValueAsync.mockResolvedValue(false);

        const result = await isFeatureEnabled('testFeature');
        expect(result).toBe(false);
        expect(mockClient.getValueAsync).toHaveBeenCalledWith('testFeature', false);
    });

    it('should throw an error if configcat client fails', async () => {
        mockClient.getValueAsync.mockRejectedValue(new Error('Client error'));

        await expect(isFeatureEnabled('testFeature')).rejects.toThrow('Client error');
    });
});
