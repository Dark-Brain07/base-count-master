import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, Trophy, Clock, Zap, Menu, X, Crown, Star } from 'lucide-react';

const CORRECT_POINTS = 10;
const WRONG_PENALTY = 5;
const TIME_LIMIT = 30;
const CONTRACT_ADDRESS = "0x8D41787dA963206f02B91732Ac72E356d77d4a94";
const CONTRACT_ABI = [
  "function submitScore(uint256 _score) external",
  "function getPlayerScore(address _player) view returns (uint256, uint256, uint256)",
  "function getLeaderboard(uint256 _limit) view returns (address[], uint256[])"
];

const BaseCountMaster = () => {
  const [gameState, setGameState] = useState('menu');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [question, setQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [streak, setStreak] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [totalGames, setTotalGames] = useState(0);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletProvider, setWalletProvider] = useState(null);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const operations = [
    { symbol: '+', name: 'addition', fn: (a, b) => a + b },
    { symbol: '-', name: 'subtraction', fn: (a, b) => a - b },
    { symbol: '×', name: 'multiplication', fn: (a, b) => a * b },
    { symbol: '÷', name: 'division', fn: (a, b) => Math.floor(a / b) }
  ];

  const generateQuestion = useCallback(() => {
    const num1 = Math.floor(Math.random() * 90) + 10;
    let num2 = Math.floor(Math.random() * 90) + 10;
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    if (operation.symbol === '÷') {
      num2 = Math.floor(Math.random() * 9) + 2;
      const temp = num1;
      const divisibleNum = temp - (temp % num2);
      const correct = operation.fn(divisibleNum, num2);
      
      const wrongOptions = [];
      while (wrongOptions.length < 3) {
        const wrong = correct + Math.floor(Math.random() * 20) - 10;
        if (wrong !== correct && !wrongOptions.includes(wrong) && wrong > 0) {
          wrongOptions.push(wrong);
        }
      }
      
      const allOptions = [correct, ...wrongOptions].sort(() => Math.random() - 0.5);
      
      setQuestion({ num1: divisibleNum, num2, operation });
      setOptions(allOptions);
      setCorrectAnswer(correct);
    } else {
      const correct = operation.fn(num1, num2);
      
      const wrongOptions = [];
      while (wrongOptions.length < 3) {
        const offset = Math.floor(Math.random() * 30) - 15;
        const wrong = correct + offset;
        if (wrong !== correct && !wrongOptions.includes(wrong)) {
          wrongOptions.push(wrong);
        }
      }
      
      const allOptions = [correct, ...wrongOptions].sort(() => Math.random() - 0.5);
      
      setQuestion({ num1, num2, operation });
      setOptions(allOptions);
      setCorrectAnswer(correct);
    }
  }, []);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && gameState === 'playing') {
      endGame();
    }
  }, [timeLeft, gameState]);

  useEffect(() => {
    if (gameState === 'playing' && !question) {
      generateQuestion();
    }
  }, [gameState, question, generateQuestion]);

  const connectWallet = async (walletType) => {
    try {
      let provider;
      
      if (walletType === 'metamask' && window.ethereum) {
        provider = window.ethereum;
      } else if (walletType === 'coinbase' && window.coinbaseWalletExtension) {
        provider = window.coinbaseWalletExtension;
      } else if (walletType === 'rainbow' && window.rainbow) {
        provider = window.rainbow;
      } else {
        alert(`${walletType} wallet not found. Please install it first.`);
        return;
      }

      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const chainId = await provider.request({ method: 'eth_chainId' });
      
      if (chainId !== '0x2105') {
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base Mainnet',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org']
              }]
            });
          }
        }
      }

      setWalletAddress(accounts[0]);
      setWalletProvider(provider);
      setShowWalletMenu(false);
      await loadPlayerData(accounts[0], provider);
    } catch (error) {
      console.error('Wallet connection failed:', error);
      alert('Failed to connect wallet');
    }
  };

  const loadPlayerData = async (address, provider) => {
    try {
      const ethers = await import('https://cdn.ethers.io/lib/ethers-5.7.2.esm.min.js');
      const web3Provider = new ethers.providers.Web3Provider(provider);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, web3Provider);
      
      const [highScore, totalGames] = await contract.getPlayerScore(address);
      setHighScore(highScore.toNumber());
      setTotalGames(totalGames.toNumber());
    } catch (error) {
      console.error('Failed to load player data:', error);
    }
  };

  const submitScoreToBlockchain = async () => {
    if (!walletAddress || !walletProvider) {
      alert('Please connect your wallet first!');
      return;
    }

    try {
      const ethers = await import('https://cdn.ethers.io/lib/ethers-5.7.2.esm.min.js');
      const web3Provider = new ethers.providers.Web3Provider(walletProvider);
      const signer = web3Provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      const tx = await contract.submitScore(score);
      alert('Score submission started! Waiting for confirmation...');
      await tx.wait();
      alert('Score saved to Base blockchain! 🎉');
      
      await loadPlayerData(walletAddress, walletProvider);
    } catch (error) {
      console.error('Failed to submit score:', error);
      alert('Failed to save score to blockchain');
    }
  };

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setTimeLeft(TIME_LIMIT);
    setStreak(0);
    setQuestion(null);
    setFeedback(null);
  };

  const endGame = () => {
    setGameState('gameover');
    if (score > highScore) {
      setHighScore(score);
    }
  };

  const handleAnswer = (selected) => {
    if (selected === correctAnswer) {
      const points = CORRECT_POINTS + streak;
      setScore(score + points);
      setStreak(streak + 1);
      setFeedback({ type: 'correct', points });
    } else {
      setScore(Math.max(0, score - WRONG_PENALTY));
      setStreak(0);
      setFeedback({ type: 'wrong' });
    }
    
    setTimeout(() => {
      setFeedback(null);
      generateQuestion();
    }, 800);
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setWalletProvider(null);
    setHighScore(0);
    setTotalGames(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white font-mono overflow-hidden relative">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-32 h-32 bg-blue-500 rounded-full animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-pink-500 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-yellow-500 rounded-full animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6 max-w-4xl">
        <header className="flex justify-between items-center mb-8 bg-black/40 backdrop-blur-sm p-4 rounded-xl border-4 border-purple-500 shadow-2xl shadow-purple-500/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center border-4 border-yellow-300 shadow-lg transform hover:scale-110 transition-transform">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-500">
                Base Count Master
              </h1>
              <p className="text-xs text-purple-300">Math Battle Arena</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {walletAddress ? (
              <button
                onClick={disconnectWallet}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg border-2 border-red-400 shadow-lg transform hover:scale-105 transition-all text-sm font-bold flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </button>
            ) : (
              <button
                onClick={() => setShowWalletMenu(!showWalletMenu)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg border-2 border-blue-400 shadow-lg transform hover:scale-105 transition-all text-sm font-bold flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect
              </button>
            )}
          </div>
        </header>

        {showWalletMenu && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-purple-900 to-indigo-900 p-8 rounded-2xl border-4 border-purple-500 shadow-2xl max-w-md w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-yellow-400">Connect Wallet</h2>
                <button onClick={() => setShowWalletMenu(false)} className="text-white hover:text-red-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => connectWallet('metamask')}
                  className="w-full px-6 py-4 bg-orange-600 hover:bg-orange-700 rounded-xl border-2 border-orange-400 shadow-lg transform hover:scale-105 transition-all font-bold text-lg"
                >
                  🦊 MetaMask
                </button>
                
                <button
                  onClick={() => connectWallet('coinbase')}
                  className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl border-2 border-blue-400 shadow-lg transform hover:scale-105 transition-all font-bold text-lg"
                >
                  🔵 Coinbase Wallet
                </button>
                
                <button
                  onClick={() => connectWallet('rainbow')}
                  className="w-full px-6 py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 rounded-xl border-2 border-pink-400 shadow-lg transform hover:scale-105 transition-all font-bold text-lg"
                >
                  🌈 Rainbow Wallet
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === 'menu' && (
          <div className="text-center space-y-8 animate-fade-in">
            <div className="bg-gradient-to-br from-yellow-400/20 to-pink-500/20 backdrop-blur-sm p-12 rounded-3xl border-4 border-yellow-400 shadow-2xl shadow-yellow-500/50 transform hover:scale-105 transition-transform">
              <div className="mb-6 flex justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center border-8 border-yellow-300 shadow-2xl animate-bounce">
                  <Zap className="w-20 h-20 text-white" />
                </div>
              </div>
              
              <h2 className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 animate-pulse">
                Base Count Master
              </h2>
              <p className="text-xl text-purple-200 mb-2">⚡ 30 Second Math Challenge ⚡</p>
              <p className="text-lg text-pink-300">+{CORRECT_POINTS} points for correct | -{WRONG_PENALTY} for wrong</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/40 backdrop-blur-sm p-6 rounded-xl border-4 border-blue-500 shadow-xl">
                <Crown className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                <p className="text-sm text-blue-300 mb-1">High Score</p>
                <p className="text-3xl font-bold text-yellow-400">{highScore}</p>
              </div>
              
              <div className="bg-black/40 backdrop-blur-sm p-6 rounded-xl border-4 border-green-500 shadow-xl">
                <Star className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm text-green-300 mb-1">Games Played</p>
                <p className="text-3xl font-bold text-green-400">{totalGames}</p>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={startGame}
                className="w-full px-8 py-6 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-2xl border-4 border-green-300 shadow-2xl shadow-green-500/50 transform hover:scale-105 transition-all text-2xl font-bold"
              >
                🎮 START GAME
              </button>
              
              {walletAddress && (
                <button
                  onClick={() => alert('Leaderboard coming soon!')}
                  className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl border-4 border-purple-400 shadow-xl transform hover:scale-105 transition-all text-xl font-bold"
                >
                  <Trophy className="w-6 h-6 inline mr-2" />
                  LEADERBOARD
                </button>
              )}
            </div>

            {!walletAddress && (
              <div className="bg-yellow-500/20 backdrop-blur-sm p-6 rounded-xl border-2 border-yellow-400 animate-pulse">
                <p className="text-yellow-300 font-bold">
                  💡 Connect your wallet to save scores on Base blockchain!
                </p>
              </div>
            )}
          </div>
        )}

        {gameState === 'playing' && question && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-black/40 backdrop-blur-sm p-4 rounded-xl border-4 border-blue-500 shadow-xl text-center">
                <Clock className="w-6 h-6 mx-auto mb-1 text-blue-400" />
                <p className={`text-3xl font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
                  {timeLeft}s
                </p>
              </div>
              
              <div className="bg-black/40 backdrop-blur-sm p-4 rounded-xl border-4 border-yellow-500 shadow-xl text-center">
                <Trophy className="w-6 h-6 mx-auto mb-1 text-yellow-400" />
                <p className="text-3xl font-bold text-yellow-400">{score}</p>
              </div>
              
              <div className="bg-black/40 backdrop-blur-sm p-4 rounded-xl border-4 border-green-500 shadow-xl text-center">
                <Zap className="w-6 h-6 mx-auto mb-1 text-green-400" />
                <p className="text-3xl font-bold text-green-400">{streak}x</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-600/40 to-pink-600/40 backdrop-blur-sm p-12 rounded-3xl border-4 border-purple-400 shadow-2xl shadow-purple-500/50 text-center">
              <div className="text-6xl font-bold mb-4 text-white drop-shadow-lg">
                {question.num1} {question.operation.symbol} {question.num2} = ?
              </div>
              <p className="text-purple-200 text-lg">Choose the correct answer!</p>
            </div>

            {feedback && (
              <div className={`text-center py-4 px-6 rounded-xl border-4 font-bold text-2xl animate-bounce ${
                feedback.type === 'correct' 
                  ? 'bg-green-500/80 border-green-300 text-white' 
                  : 'bg-red-500/80 border-red-300 text-white'
              }`}>
                {feedback.type === 'correct' 
                  ? `✓ Correct! +${feedback.points} points!` 
                  : `✗ Wrong! -${WRONG_PENALTY} points`}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(option)}
                  disabled={feedback !== null}
                  className="p-8 bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 rounded-2xl border-4 border-blue-400 shadow-2xl shadow-blue-500/50 transform hover:scale-105 disabled:scale-100 transition-all text-4xl font-bold"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="bg-gradient-to-br from-purple-600/40 to-pink-600/40 backdrop-blur-sm p-12 rounded-3xl border-4 border-purple-400 shadow-2xl">
              <h2 className="text-4xl font-bold mb-6 text-yellow-400">Game Over!</h2>
              
              <div className="space-y-4 mb-8">
                <div className="bg-black/40 p-6 rounded-xl border-4 border-yellow-500">
                  <p className="text-yellow-300 mb-2">Final Score</p>
                  <p className="text-6xl font-bold text-yellow-400">{score}</p>
                </div>
                
                {score > highScore && (
                  <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-4 rounded-xl border-4 border-yellow-300 animate-pulse">
                    <p className="text-2xl font-bold">🎉 NEW HIGH SCORE! 🎉</p>
                  </div>
                )}
                
                <div className="bg-black/40 p-4 rounded-xl border-2 border-green-500">
                  <p className="text-green-300 mb-1">Streak</p>
                  <p className="text-3xl font-bold text-green-400">{streak}x</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={startGame}
                  className="w-full px-8 py-6 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-2xl border-4 border-green-300 shadow-2xl transform hover:scale-105 transition-all text-2xl font-bold"
                >
                  🔄 PLAY AGAIN
                </button>
                
                {walletAddress && (
                  <button
                    onClick={submitScoreToBlockchain}
                    className="w-full px-8 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-2xl border-4 border-blue-400 shadow-2xl transform hover:scale-105 transition-all text-xl font-bold"
                  >
                    💾 SAVE TO BLOCKCHAIN
                  </button>
                )}
                
                <button
                  onClick={() => setGameState('menu')}
                  className="w-full px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl border-4 border-gray-500 shadow-xl transform hover:scale-105 transition-all text-lg font-bold"
                >
                  🏠 MAIN MENU
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseCountMaster;
