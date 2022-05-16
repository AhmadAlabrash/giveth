import {
	createContext,
	FC,
	useCallback,
	useContext,
	useEffect,
	useState,
} from 'react';
import { AddressZero } from '@ethersproject/constants';
import { useWeb3React } from '@web3-react/core';
import { useSelector } from 'react-redux';
import config from '@/configuration';
import { TokenDistroHelper } from '@/lib/contractHelper/TokenDistroHelper';
import { StreamType } from '@/types/config';
import { RootState } from '@/stores/store';

export interface IRegenTokenDistroHelpers {
	[key: string]: TokenDistroHelper;
}
export interface ITokenDistroContext {
	givTokenDistroHelper: TokenDistroHelper;
	regenTokenDistroHelpers: IRegenTokenDistroHelpers;
	getTokenDistroHelper: (
		streamType: StreamType | undefined,
	) => TokenDistroHelper;
}

const defaultTokenDistroHelper = new TokenDistroHelper({
	contractAddress: AddressZero,
	initialAmount: '0',
	lockedAmount: '0',
	totalTokens: '0',
	startTime: 0,
	cliffTime: 0,
	endTime: 0,
});

export const TokenDistroContext = createContext<ITokenDistroContext>({
	givTokenDistroHelper: defaultTokenDistroHelper,
	regenTokenDistroHelpers: {},
	getTokenDistroHelper: () => defaultTokenDistroHelper,
});

TokenDistroContext.displayName = 'TokenDistroContext';

export const TokenDistroProvider: FC = ({ children }) => {
	const { chainId } = useWeb3React();

	const [currentGivTokenDistroInfo, setCurrentGivTokenDistroInfo] =
		useState<TokenDistroHelper>(defaultTokenDistroHelper);
	const [mainnetGivTokenDistro, setMainnetGivTokenDistro] =
		useState<TokenDistroHelper>(defaultTokenDistroHelper);
	const [xDaiGivTokenDistro, setXDaiGivTokenDistro] =
		useState<TokenDistroHelper>(defaultTokenDistroHelper);

	const [currentRegenTokenDistroHelpers, setCurrentRegenTokenDistroHelpers] =
		useState<IRegenTokenDistroHelpers>({});
	const [mainnetRegenTokenHelpers, setMainnetRegenTokenHelpers] =
		useState<IRegenTokenDistroHelpers>({});
	const [xDaiRegenTokenDistroHelpers, setXDaiRegenTokenDistroHelpers] =
		useState<IRegenTokenDistroHelpers>({});

	const { mainnetValues, xDaiValues } = useSelector(
		(state: RootState) => state.subgraph,
	);

	useEffect(() => {
		if (mainnetValues?.tokenDistroInfo)
			setMainnetGivTokenDistro(
				new TokenDistroHelper(mainnetValues.tokenDistroInfo),
			);
		const newRegenTokenDistroHelpers: IRegenTokenDistroHelpers = {};
		config.MAINNET_CONFIG.regenStreams.forEach(({ type }) => {
			const tokenDistroInfo = mainnetValues[type];
			newRegenTokenDistroHelpers[type] = tokenDistroInfo
				? new TokenDistroHelper(tokenDistroInfo, type)
				: defaultTokenDistroHelper;
		});
		setMainnetRegenTokenHelpers(newRegenTokenDistroHelpers);
	}, [mainnetValues]);

	useEffect(() => {
		if (xDaiValues.tokenDistroInfo)
			setXDaiGivTokenDistro(
				new TokenDistroHelper(xDaiValues.tokenDistroInfo),
			);
		const newRegenTokenDistroHelpers: IRegenTokenDistroHelpers = {};
		config.XDAI_CONFIG.regenStreams.forEach(({ type }) => {
			const tokenDistroInfo = xDaiValues[type];
			if (tokenDistroInfo) {
				newRegenTokenDistroHelpers[type] = new TokenDistroHelper(
					tokenDistroInfo,
					type,
				);
			}
		});
		setXDaiRegenTokenDistroHelpers(newRegenTokenDistroHelpers);
	}, [xDaiValues]);

	useEffect(() => {
		switch (chainId) {
			case config.XDAI_NETWORK_NUMBER:
				setCurrentGivTokenDistroInfo(xDaiGivTokenDistro);
				setCurrentRegenTokenDistroHelpers(xDaiRegenTokenDistroHelpers);
				break;

			case config.MAINNET_NETWORK_NUMBER:
			default:
				setCurrentGivTokenDistroInfo(mainnetGivTokenDistro);
				setCurrentRegenTokenDistroHelpers(mainnetRegenTokenHelpers);
		}
	}, [
		mainnetGivTokenDistro,
		xDaiGivTokenDistro,
		chainId,
		xDaiRegenTokenDistroHelpers,
		mainnetRegenTokenHelpers,
	]);

	const getTokenDistroHelper = useCallback(
		(streamType: StreamType | undefined) => {
			if (!streamType) return currentGivTokenDistroInfo;
			return currentRegenTokenDistroHelpers[streamType];
		},
		[currentGivTokenDistroInfo, currentRegenTokenDistroHelpers],
	);

	return (
		<TokenDistroContext.Provider
			value={{
				givTokenDistroHelper: currentGivTokenDistroInfo,
				regenTokenDistroHelpers: currentRegenTokenDistroHelpers,
				getTokenDistroHelper,
			}}
		>
			{children}
		</TokenDistroContext.Provider>
	);
};

export function useTokenDistro() {
	const context = useContext(TokenDistroContext);

	if (!context) {
		throw new Error('Token distro context not found!');
	}

	return context;
}
