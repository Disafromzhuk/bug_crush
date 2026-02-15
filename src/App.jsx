import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Info, Bug } from 'lucide-react';

const GRID_SIZES = [
  { value: 10, label: '10×10 - Быстрая', cellSize: 28 },
  { value: 15, label: '15×15 - Средняя', cellSize: 24 },
  { value: 20, label: '20×20 - Стандарт', cellSize: 22 },
  { value: 25, label: '25×25 - Большая', cellSize: 18 }
];

const CELL_TYPES = {
  EMPTY: 'empty',
  ACTIVE: 'active',
  INFECTED: 'infected'
};

const GAME_PHASES = {
  SETUP: 'setup',
  PLACEMENT: 'placement',
  PLAYING: 'playing',
  ENDED: 'ended'
};

const PLAYER_COLORS = [
  { name: 'Зелёные клопы', color: '#00ff88', glowColor: 'rgba(0, 255, 136, 0.4)' },
  { name: 'Синие клопы', color: '#00d4ff', glowColor: 'rgba(0, 212, 255, 0.4)' },
  { name: 'Фиолетовые клопы', color: '#b84dff', glowColor: 'rgba(184, 77, 255, 0.4)' },
  { name: 'Оранжевые клопы', color: '#ff6b35', glowColor: 'rgba(255, 107, 53, 0.4)' }
];

export default function KlopyGame() {
  const [gamePhase, setGamePhase] = useState(GAME_PHASES.SETUP);
  const [gridSize, setGridSize] = useState(20);
  const [cellSize, setCellSize] = useState(22);
  const [grid, setGrid] = useState([]);
  const [players, setPlayers] = useState([
    { id: 1, color: PLAYER_COLORS[0], score: 0 },
    { id: 2, color: PLAYER_COLORS[1], score: 0 }
  ]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [actionsLeft, setActionsLeft] = useState(3);
  const [selectedCell, setSelectedCell] = useState(null);
  const [availableActions, setAvailableActions] = useState({ birth: [], attack: [] });
  const [showRules, setShowRules] = useState(false);
  const [log, setLog] = useState([]);
  const [placementOrder, setPlacementOrder] = useState([]);

  // Initialize grid
  const initializeGrid = (size) => {
    const newGrid = Array(size).fill(null).map(() =>
      Array(size).fill(null).map(() => ({
        type: CELL_TYPES.EMPTY,
        owner: null
      }))
    );
    return newGrid;
  };

  useEffect(() => {
    setGrid(initializeGrid(gridSize));
  }, [gridSize]);

  // Start game
  const startGame = (selectedSize, selectedCellSize) => {
    setGridSize(selectedSize);
    setCellSize(selectedCellSize);
    setGrid(initializeGrid(selectedSize));
    
    // Randomly determine placement order
    const order = Math.random() < 0.5 ? [0, 1] : [1, 0];
    setPlacementOrder(order);
    setCurrentPlayer(order[0]);
    setGamePhase(GAME_PHASES.PLACEMENT);
    addLog(`${players[order[0]].color.name} размещает стартового клопа первым`);
  };

  // Check if player can make any moves
  const canPlayerMove = (playerId) => {
    const actions = calculateAvailableActions(playerId);
    return actions.birth.length > 0 || actions.attack.length > 0;
  };

  // Check if player has any active cells
  const hasActiveCells = (playerId) => {
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const cell = grid[row][col];
        if (cell.type === CELL_TYPES.ACTIVE && cell.owner === playerId) {
          return true;
        }
      }
    }
    return false;
  };

  // Add log message
  const addLog = (message) => {
    setLog(prev => [...prev, { text: message, time: Date.now() }]);
  };

  // Get neighbors
  const getNeighbors = (row, col) => {
    const neighbors = [];
    if (row > 0) neighbors.push([row - 1, col]);
    if (row < gridSize - 1) neighbors.push([row + 1, col]);
    if (col > 0) neighbors.push([row, col - 1]);
    if (col < gridSize - 1) neighbors.push([row, col + 1]);
    return neighbors;
  };

  // Check if cell is adjacent to player's cells
  const isAdjacentToPlayer = (row, col, playerId) => {
    const neighbors = getNeighbors(row, col);
    return neighbors.some(([r, c]) => grid[r][c].owner === playerId);
  };

  // Calculate available actions
  const calculateAvailableActions = (playerId) => {
    const birth = [];
    const attack = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const cell = grid[row][col];
        
        // Birth: empty cell adjacent to player's cells
        if (cell.type === CELL_TYPES.EMPTY && isAdjacentToPlayer(row, col, playerId)) {
          birth.push([row, col]);
        }
        
        // Attack: enemy active cell adjacent to player's cells
        if (cell.type === CELL_TYPES.ACTIVE && cell.owner !== playerId && 
            isAdjacentToPlayer(row, col, playerId)) {
          attack.push([row, col]);
        }
      }
    }

    return { birth, attack };
  };

  // Check if enemy cell is surrounded (single unit check)
  const isSurrounded = (row, col, attackerPlayerId) => {
    const neighbors = getNeighbors(row, col);
    return neighbors.every(([r, c]) => {
      const cell = grid[r][c];
      return cell.owner === attackerPlayerId;
    });
  };

  // Find connected group of enemy cells using flood fill
  const findConnectedEnemyGroup = (startRow, startCol, enemyPlayerId, visited) => {
    const group = [];
    const queue = [[startRow, startCol]];
    const localVisited = new Set();

    while (queue.length > 0) {
      const [row, col] = queue.shift();
      const key = `${row},${col}`;

      if (localVisited.has(key) || visited.has(key)) continue;
      
      const cell = grid[row][col];
      
      // Only include active enemy cells in the group
      if (cell.type !== CELL_TYPES.ACTIVE || cell.owner !== enemyPlayerId) {
        continue;
      }

      localVisited.add(key);
      visited.add(key);
      group.push([row, col]);

      // Add neighboring enemy cells to queue
      const neighbors = getNeighbors(row, col);
      for (const [nr, nc] of neighbors) {
        const nKey = `${nr},${nc}`;
        if (!localVisited.has(nKey) && !visited.has(nKey)) {
          const neighborCell = grid[nr][nc];
          if (neighborCell.type === CELL_TYPES.ACTIVE && neighborCell.owner === enemyPlayerId) {
            queue.push([nr, nc]);
          }
        }
      }
    }

    return group;
  };

  // Check if a group of enemy cells is completely surrounded
  const isGroupSurrounded = (group, attackerPlayerId) => {
    // For each cell in the group, check if all its neighbors that are not in the group
    // belong to the attacker
    for (const [row, col] of group) {
      const neighbors = getNeighbors(row, col);
      
      for (const [nr, nc] of neighbors) {
        const neighborCell = grid[nr][nc];
        
        // If neighbor is in the group, skip it
        const isInGroup = group.some(([gr, gc]) => gr === nr && gc === nc);
        if (isInGroup) continue;

        // If neighbor is empty or belongs to another player (not attacker), not surrounded
        if (neighborCell.owner !== attackerPlayerId) {
          return false;
        }
      }
    }

    return true;
  };

  // Check if there are any empty cells within or adjacent to the group
  const hasEmptyCellsInRegion = (group) => {
    // Collect all cells that are either in the group or adjacent to it
    const regionCells = new Set();
    
    for (const [row, col] of group) {
      regionCells.add(`${row},${col}`);
      
      const neighbors = getNeighbors(row, col);
      for (const [nr, nc] of neighbors) {
        regionCells.add(`${nr},${nc}`);
      }
    }

    // Check if any of these cells are empty
    for (const key of regionCells) {
      const [row, col] = key.split(',').map(Number);
      if (grid[row][col].type === CELL_TYPES.EMPTY) {
        return true;
      }
    }

    return false;
  };

  // Check for surrounded cells for a specific attacker
  const checkAndInfectSurroundedByPlayer = (attackerPlayerId) => {
    const toInfect = new Set();
    const visited = new Set();

    // Check all enemy players' cells
    for (const player of players) {
      if (player.id === attackerPlayerId) continue; // Skip attacker's own cells
      
      const enemyPlayerId = player.id;
      
      // Find all connected groups of this enemy's cells
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const key = `${row},${col}`;
          if (visited.has(key)) continue;

          const cell = grid[row][col];
          
          // Look for enemy active cells
          if (cell.type === CELL_TYPES.ACTIVE && cell.owner === enemyPlayerId) {
            const group = findConnectedEnemyGroup(row, col, enemyPlayerId, visited);
            
            if (group.length > 0) {
              // Check if this group is surrounded by attacker
              if (isGroupSurrounded(group, attackerPlayerId)) {
                // For single cells, always surround
                // For groups, check if there are no empty cells
                if (group.length === 1) {
                  group.forEach(([r, c]) => toInfect.add(`${r},${c}`));
                } else {
                  // Check if there are empty cells in the region
                  if (!hasEmptyCellsInRegion(group)) {
                    group.forEach(([r, c]) => toInfect.add(`${r},${c}`));
                  }
                }
              }
            }
          }
        }
      }
    }

    return { toInfect, attackerId: attackerPlayerId };
  };

  // Check for surrounded cells and infect them (check ALL players as potential attackers)
  const checkAndInfectSurrounded = () => {
    let totalInfected = new Map(); // Map of attacker -> set of infected cells

    // Check for each player if they have surrounded enemy cells
    for (const player of players) {
      const { toInfect, attackerId } = checkAndInfectSurroundedByPlayer(player.id);
      if (toInfect.size > 0) {
        totalInfected.set(attackerId, toInfect);
      }
    }

    if (totalInfected.size > 0) {
      const newGrid = [...grid.map(row => [...row])];
      
      // Apply all infections
      for (const [attackerId, cells] of totalInfected.entries()) {
        const attackerName = players.find(p => p.id === attackerId)?.color.name;
        
        cells.forEach(key => {
          const [row, col] = key.split(',').map(Number);
          newGrid[row][col] = {
            type: CELL_TYPES.INFECTED,
            owner: attackerId
          };
        });

        if (cells.size === 1) {
          addLog(`🦠 Окружение! ${attackerName} заразил 1 клопа`);
        } else {
          addLog(`🦠 Массовое окружение! ${attackerName} заразил ${cells.size} клопов`);
        }
      }
      
      setGrid(newGrid);
    }
  };

  // Handle cell click during placement
  const handlePlacementClick = (row, col) => {
    if (grid[row][col].type !== CELL_TYPES.EMPTY) return;

    const newGrid = [...grid.map(row => [...row])];
    newGrid[row][col] = {
      type: CELL_TYPES.ACTIVE,
      owner: players[currentPlayer].id
    };
    setGrid(newGrid);
    
    addLog(`${players[currentPlayer].color.name} разместил стартового клопа на [${row}, ${col}]`);

    const currentIndex = placementOrder.indexOf(currentPlayer);
    if (currentIndex === 0) {
      // First player placed, now second player
      setCurrentPlayer(placementOrder[1]);
      addLog(`${players[placementOrder[1]].color.name} размещает стартового клопа`);
    } else {
      // Both placed, start game
      setCurrentPlayer(placementOrder[0]); // First placer goes first
      setGamePhase(GAME_PHASES.PLAYING);
      setActionsLeft(3);
      addLog(`🎮 Игра началась! Ходит ${players[placementOrder[0]].color.name}`);
    }
  };

  // Handle cell click during game
  const handleCellClick = (row, col) => {
    if (gamePhase === GAME_PHASES.PLACEMENT) {
      handlePlacementClick(row, col);
      return;
    }

    if (gamePhase !== GAME_PHASES.PLAYING || actionsLeft === 0) return;

    const cell = grid[row][col];
    const playerId = players[currentPlayer].id;
    const actions = calculateAvailableActions(playerId);

    // Birth action
    if (cell.type === CELL_TYPES.EMPTY && 
        actions.birth.some(([r, c]) => r === row && c === col)) {
      const newGrid = [...grid.map(row => [...row])];
      newGrid[row][col] = {
        type: CELL_TYPES.ACTIVE,
        owner: playerId
      };
      setGrid(newGrid);
      setActionsLeft(actionsLeft - 1);
      addLog(`${players[currentPlayer].color.name} родил клопа на [${row}, ${col}]`);
      return;
    }

    // Attack action
    if (cell.type === CELL_TYPES.ACTIVE && cell.owner !== playerId &&
        actions.attack.some(([r, c]) => r === row && c === col)) {
      const newGrid = [...grid.map(row => [...row])];
      newGrid[row][col] = {
        type: CELL_TYPES.INFECTED,
        owner: playerId
      };
      setGrid(newGrid);
      setActionsLeft(actionsLeft - 1);
      addLog(`${players[currentPlayer].color.name} заразил клопа на [${row}, ${col}]`);
      return;
    }
  };

  // End turn
  useEffect(() => {
    if (gamePhase === GAME_PHASES.PLAYING && actionsLeft === 0) {
      // Check for surrounded cells for ALL players
      checkAndInfectSurrounded();
      
      // After infections, check if any player is eliminated or cannot move
      const player1Id = players[0].id;
      const player2Id = players[1].id;
      
      const player1CanMove = hasActiveCells(player1Id) && canPlayerMove(player1Id);
      const player2CanMove = hasActiveCells(player2Id) && canPlayerMove(player2Id);
      
      // If either player cannot move, end the game
      if (!player1CanMove || !player2CanMove) {
        endGame();
        return;
      }

      setCurrentPlayer((currentPlayer + 1) % 2);
      setActionsLeft(3);
      addLog(`Ход ${players[(currentPlayer + 1) % 2].color.name}`);
    }
  }, [actionsLeft, gamePhase]);

  // Update available actions
  useEffect(() => {
    if (gamePhase === GAME_PHASES.PLAYING) {
      const playerId = players[currentPlayer].id;
      
      // Check if player has any active cells
      if (!hasActiveCells(playerId)) {
        // Player has no active cells, end game
        endGame();
        return;
      }
      
      const actions = calculateAvailableActions(playerId);
      setAvailableActions(actions);
      
      // Auto-skip if no actions available but player has cells
      if (actions.birth.length === 0 && actions.attack.length === 0 && actionsLeft > 0) {
        addLog(`${players[currentPlayer].color.name} не может сделать ход`);
        setActionsLeft(0);
      }
    }
  }, [currentPlayer, grid, gamePhase, actionsLeft]);

  // Calculate scores
  useEffect(() => {
    const scores = [0, 0];
    grid.forEach(row => {
      row.forEach(cell => {
        if (cell.owner) {
          const playerIndex = players.findIndex(p => p.id === cell.owner);
          if (playerIndex !== -1) scores[playerIndex]++;
        }
      });
    });
    
    setPlayers(prev => prev.map((p, i) => ({ ...p, score: scores[i] })));
  }, [grid]);

  // End game
  const endGame = () => {
    setGamePhase(GAME_PHASES.ENDED);
    const winner = players[0].score > players[1].score ? players[0] : 
                   players[1].score > players[0].score ? players[1] : null;
    if (winner) {
      addLog(`🏆 ${winner.color.name.toUpperCase()} ПОБЕДИЛИ! Счёт: ${winner.score}`);
    } else {
      addLog(`🤝 Ничья! Счёт: ${players[0].score} - ${players[1].score}`);
    }
  };

  // Reset game
  const resetGame = () => {
    setGamePhase(GAME_PHASES.SETUP);
    setGridSize(20);
    setCellSize(22);
    setGrid(initializeGrid(20));
    setCurrentPlayer(0);
    setActionsLeft(3);
    setLog([]);
    setPlacementOrder([]);
  };

  // Render cell
  const renderCell = (cell, row, col) => {
    const isAvailableBirth = availableActions.birth.some(([r, c]) => r === row && c === col);
    const isAvailableAttack = availableActions.attack.some(([r, c]) => r === row && c === col);
    const playerColor = cell.owner ? players.find(p => p.id === cell.owner)?.color : null;
    const currentPlayerColor = players[currentPlayer]?.color;

    let cellStyle = {};
    let cellClass = 'cell';

    if (cell.type === CELL_TYPES.EMPTY) {
      if (gamePhase === GAME_PHASES.PLACEMENT) {
        cellClass += ' placement-available';
        cellStyle.borderColor = currentPlayerColor?.color;
        cellStyle.boxShadow = `0 0 10px ${currentPlayerColor?.glowColor}`;
      } else if (isAvailableBirth) {
        cellClass += ' birth-available';
        cellStyle.borderColor = currentPlayerColor?.color;
        cellStyle.backgroundColor = `${currentPlayerColor?.color}20`;
        cellStyle.boxShadow = `0 0 10px ${currentPlayerColor?.glowColor}`;
      }
    } else if (cell.type === CELL_TYPES.ACTIVE) {
      cellClass += ' active-cell';
      cellStyle.backgroundColor = playerColor?.color;
      cellStyle.boxShadow = `0 0 20px ${playerColor?.glowColor}`;
      if (isAvailableAttack) {
        cellClass += ' attack-available';
        cellStyle.borderColor = currentPlayerColor?.color;
        cellStyle.boxShadow = `0 0 20px ${playerColor?.glowColor}, 0 0 15px ${currentPlayerColor?.glowColor}`;
      }
    } else if (cell.type === CELL_TYPES.INFECTED) {
      cellClass += ' infected-cell';
      cellStyle.backgroundColor = playerColor?.color;
    }

    return (
      <div
        key={`${row}-${col}`}
        className={cellClass}
        style={cellStyle}
        onClick={() => handleCellClick(row, col)}
      >
        {cell.type === CELL_TYPES.ACTIVE && (
          <Bug 
            size={cellSize * 0.6} 
            className="bug-icon"
            style={{ 
              color: 'rgba(0, 0, 0, 0.5)',
              filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.3))'
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="game-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          background: radial-gradient(circle at center, #0a0e1a 0%, #020308 100%);
          overflow-x: hidden;
        }

        .game-container {
          min-height: 100vh;
          background: 
            radial-gradient(circle at 20% 30%, rgba(0, 255, 136, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(0, 212, 255, 0.03) 0%, transparent 50%),
            #0a0e1a;
          color: #00ff88;
          font-family: 'Share Tech Mono', monospace;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        .game-container::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            repeating-linear-gradient(0deg, rgba(0, 255, 136, 0.03) 0px, transparent 1px, transparent 2px, rgba(0, 255, 136, 0.03) 3px),
            repeating-linear-gradient(90deg, rgba(0, 212, 255, 0.03) 0px, transparent 1px, transparent 2px, rgba(0, 212, 255, 0.03) 3px);
          pointer-events: none;
          animation: scanlines 8s linear infinite;
        }

        @keyframes scanlines {
          0% { transform: translateY(0); }
          100% { transform: translateY(4px); }
        }

        .header {
          text-align: center;
          margin-bottom: 30px;
          position: relative;
          z-index: 10;
        }

        .title {
          font-family: 'Orbitron', sans-serif;
          font-size: 48px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 8px;
          background: linear-gradient(135deg, #00ff88, #00d4ff, #b84dff);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 40px rgba(0, 255, 136, 0.5);
          margin-bottom: 10px;
          animation: pulse-glow 3s ease-in-out infinite;
        }

        @keyframes pulse-glow {
          0%, 100% { filter: brightness(1) drop-shadow(0 0 20px rgba(0, 255, 136, 0.5)); }
          50% { filter: brightness(1.3) drop-shadow(0 0 40px rgba(0, 255, 136, 0.8)); }
        }

        .subtitle {
          font-size: 14px;
          color: #00d4ff;
          letter-spacing: 4px;
          opacity: 0.7;
          text-transform: uppercase;
        }

        .main-content {
          display: flex;
          gap: 30px;
          max-width: 1400px;
          margin: 0 auto;
          position: relative;
          z-index: 10;
        }

        .game-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .grid-container {
          background: rgba(10, 14, 26, 0.8);
          border: 2px solid rgba(0, 255, 136, 0.3);
          border-radius: 10px;
          padding: 15px;
          box-shadow: 
            0 0 40px rgba(0, 255, 136, 0.2),
            inset 0 0 40px rgba(0, 0, 0, 0.5);
          position: relative;
        }

        .grid-container::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 212, 255, 0.2));
          border-radius: 10px;
          z-index: -1;
          animation: border-pulse 2s ease-in-out infinite;
        }

        @keyframes border-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(var(--grid-size), var(--cell-size));
          grid-template-rows: repeat(var(--grid-size), var(--cell-size));
          gap: 2px;
          background: rgba(0, 0, 0, 0.5);
          padding: 5px;
          border-radius: 5px;
        }

        .cell {
          width: var(--cell-size);
          height: var(--cell-size);
          background: rgba(20, 30, 50, 0.4);
          border: 1px solid rgba(0, 255, 136, 0.1);
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cell:hover {
          background: rgba(0, 255, 136, 0.1);
          border-color: rgba(0, 255, 136, 0.3);
          transform: scale(1.1);
        }

        .placement-available {
          animation: placement-pulse 1.5s ease-in-out infinite;
        }

        @keyframes placement-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .birth-available {
          animation: birth-pulse 1.5s ease-in-out infinite;
        }

        @keyframes birth-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .attack-available {
          animation: attack-pulse 1s ease-in-out infinite;
          cursor: crosshair;
        }

        @keyframes attack-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }

        .active-cell {
          border-radius: 50%;
          animation: organism-pulse 2s ease-in-out infinite;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        @keyframes organism-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        .active-marker {
          font-size: 16px;
          font-weight: bold;
          color: rgba(0, 0, 0, 0.6);
          animation: marker-rotate 4s linear infinite;
        }

        @keyframes marker-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .bug-icon {
          animation: bug-wiggle 2s ease-in-out infinite;
        }

        @keyframes bug-wiggle {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }

        .infected-cell {
          border-radius: 50%;
          opacity: 0.6;
          animation: infected-grow 0.5s ease-out;
        }

        @keyframes infected-grow {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.3); opacity: 0.8; }
          100% { transform: scale(1); opacity: 0.6; }
        }

        .sidebar {
          width: 320px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .panel {
          background: rgba(10, 14, 26, 0.9);
          border: 1px solid rgba(0, 255, 136, 0.3);
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.1);
        }

        .panel-title {
          font-family: 'Orbitron', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #00d4ff;
          margin-bottom: 15px;
          text-transform: uppercase;
          letter-spacing: 2px;
          border-bottom: 1px solid rgba(0, 212, 255, 0.3);
          padding-bottom: 8px;
        }

        .player-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          margin-bottom: 10px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid transparent;
          transition: all 0.3s ease;
        }

        .player-info.active {
          border-color: currentColor;
          background: rgba(0, 0, 0, 0.5);
          box-shadow: 0 0 20px currentColor;
          animation: active-player-pulse 2s ease-in-out infinite;
        }

        @keyframes active-player-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        .player-color {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 3px solid currentColor;
          box-shadow: 0 0 15px currentColor;
          animation: color-pulse 3s ease-in-out infinite;
        }

        @keyframes color-pulse {
          0%, 100% { box-shadow: 0 0 15px currentColor; }
          50% { box-shadow: 0 0 25px currentColor; }
        }

        .player-details {
          flex: 1;
        }

        .player-name {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 4px;
          color: currentColor;
        }

        .player-score {
          font-size: 20px;
          font-family: 'Orbitron', sans-serif;
          font-weight: 700;
          color: currentColor;
        }

        .actions-info {
          text-align: center;
          padding: 15px;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 8px;
          margin-top: 10px;
        }

        .actions-label {
          font-size: 12px;
          color: #00d4ff;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .actions-count {
          font-family: 'Orbitron', sans-serif;
          font-size: 36px;
          font-weight: 900;
          color: #00ff88;
          text-shadow: 0 0 20px rgba(0, 255, 136, 0.6);
        }

        .game-log {
          max-height: 300px;
          overflow-y: auto;
          font-size: 12px;
          line-height: 1.6;
        }

        .game-log::-webkit-scrollbar {
          width: 6px;
        }

        .game-log::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 3px;
        }

        .game-log::-webkit-scrollbar-thumb {
          background: rgba(0, 255, 136, 0.5);
          border-radius: 3px;
        }

        .log-entry {
          padding: 8px;
          margin-bottom: 5px;
          background: rgba(0, 0, 0, 0.3);
          border-left: 3px solid rgba(0, 255, 136, 0.5);
          border-radius: 4px;
          animation: log-fade-in 0.3s ease-out;
        }

        @keyframes log-fade-in {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .controls {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 212, 255, 0.2));
          border: 2px solid rgba(0, 255, 136, 0.5);
          border-radius: 8px;
          color: #00ff88;
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 0 15px rgba(0, 255, 136, 0.2);
        }

        .btn:hover {
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.3), rgba(0, 212, 255, 0.3));
          border-color: rgba(0, 255, 136, 0.8);
          box-shadow: 0 0 25px rgba(0, 255, 136, 0.4);
          transform: translateY(-2px);
        }

        .btn:active {
          transform: translateY(0);
        }

        .btn-secondary {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
          border-color: rgba(255, 255, 255, 0.3);
          color: #ffffff;
        }

        .btn-secondary:hover {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.1));
          border-color: rgba(255, 255, 255, 0.5);
          box-shadow: 0 0 25px rgba(255, 255, 255, 0.2);
        }

        .rules-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: modal-fade-in 0.3s ease-out;
        }

        @keyframes modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .rules-content {
          background: rgba(10, 14, 26, 0.95);
          border: 2px solid rgba(0, 255, 136, 0.5);
          border-radius: 15px;
          padding: 30px;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 0 50px rgba(0, 255, 136, 0.3);
          animation: modal-slide-in 0.3s ease-out;
        }

        @keyframes modal-slide-in {
          from { transform: translateY(-30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .rules-content h3 {
          font-family: 'Orbitron', sans-serif;
          color: #00d4ff;
          margin-bottom: 15px;
          font-size: 24px;
        }

        .rules-content p, .rules-content li {
          color: #00ff88;
          line-height: 1.8;
          margin-bottom: 10px;
        }

        .rules-content ul {
          list-style: none;
          padding-left: 0;
        }

        .rules-content li::before {
          content: '🦠 ';
          margin-right: 8px;
        }

        .phase-indicator {
          text-align: center;
          padding: 15px;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 8px;
          margin-bottom: 20px;
          border: 1px solid rgba(0, 212, 255, 0.3);
        }

        .phase-label {
          font-family: 'Orbitron', sans-serif;
          font-size: 18px;
          color: #00d4ff;
          text-transform: uppercase;
          letter-spacing: 3px;
          animation: phase-blink 2s ease-in-out infinite;
        }

        @keyframes phase-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .winner-announcement {
          text-align: center;
          padding: 30px;
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 212, 255, 0.2));
          border: 3px solid;
          border-radius: 15px;
          margin: 20px 0;
          animation: winner-pulse 1.5s ease-in-out infinite;
        }

        @keyframes winner-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 30px currentColor; }
          50% { transform: scale(1.05); box-shadow: 0 0 50px currentColor; }
        }

        .winner-text {
          font-family: 'Orbitron', sans-serif;
          font-size: 28px;
          font-weight: 900;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 4px;
        }

        .size-selector {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin: 20px 0;
        }

        .size-option {
          padding: 20px;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(0, 255, 136, 0.3);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
        }

        .size-option:hover {
          background: rgba(0, 255, 136, 0.1);
          border-color: rgba(0, 255, 136, 0.6);
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
          transform: translateY(-2px);
        }

        .size-value {
          font-family: 'Orbitron', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: #00ff88;
          margin-bottom: 5px;
        }

        .size-label {
          font-size: 12px;
          color: #00d4ff;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        @media (max-width: 1200px) {
          .main-content {
            flex-direction: column;
            align-items: center;
          }
          
          .sidebar {
            width: 100%;
            max-width: 600px;
          }
        }

        @media (max-width: 600px) {
          .title {
            font-size: 32px;
            letter-spacing: 4px;
          }
          
          .size-selector {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="header">
        <h1 className="title">КЛОПОДАВКА</h1>
        <p className="subtitle">● Биологическая Стратегия ●</p>
      </div>

      <div className="main-content">
        <div className="game-area">
          {gamePhase === GAME_PHASES.SETUP && (
            <div className="panel" style={{ maxWidth: '600px', textAlign: 'center' }}>
              <h3 className="panel-title">Лабораторный Эксперимент</h3>
              <p style={{ marginBottom: '20px', lineHeight: '1.8' }}>
                Добро пожаловать в биологическую лабораторию! Два штамма микроорганизмов 
                будут бороться за доминирование на клеточном поле.
              </p>
              
              <h4 style={{ color: '#00d4ff', marginBottom: '15px', fontSize: '16px' }}>
                Выберите размер поля:
              </h4>
              
              <div className="size-selector">
                {GRID_SIZES.map(size => (
                  <div 
                    key={size.value}
                    className="size-option"
                    onClick={() => startGame(size.value, size.cellSize)}
                  >
                    <div className="size-value">{size.value}×{size.value}</div>
                    <div className="size-label">{size.label.split(' - ')[1]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gamePhase === GAME_PHASES.PLACEMENT && (
            <div className="phase-indicator">
              <div className="phase-label">
                🧬 Размещение Стартовых Клопов
              </div>
            </div>
          )}

          {(gamePhase === GAME_PHASES.PLACEMENT || gamePhase === GAME_PHASES.PLAYING || 
            gamePhase === GAME_PHASES.ENDED) && (
            <div 
              className="grid-container"
              style={{
                '--grid-size': gridSize,
                '--cell-size': `${cellSize}px`
              }}
            >
              <div className="grid">
                {grid.map((row, rowIndex) => 
                  row.map((cell, colIndex) => renderCell(cell, rowIndex, colIndex))
                )}
              </div>
            </div>
          )}
        </div>

        {(gamePhase === GAME_PHASES.PLACEMENT || gamePhase === GAME_PHASES.PLAYING || 
          gamePhase === GAME_PHASES.ENDED) && (
          <div className="sidebar">
            <div className="panel">
              <h3 className="panel-title">Статус Клопов</h3>
              {players.map((player, index) => (
                <div 
                  key={player.id} 
                  className={`player-info ${currentPlayer === index && gamePhase === GAME_PHASES.PLAYING ? 'active' : ''}`}
                  style={{ color: player.color.color }}
                >
                  <div 
                    className="player-color" 
                    style={{ 
                      backgroundColor: player.color.color,
                      borderColor: player.color.color 
                    }}
                  />
                  <div className="player-details">
                    <div className="player-name">{player.color.name}</div>
                    <div className="player-score">{player.score} клеток</div>
                  </div>
                </div>
              ))}

              {gamePhase === GAME_PHASES.PLAYING && (
                <div className="actions-info">
                  <div className="actions-label">Осталось действий</div>
                  <div className="actions-count">{actionsLeft}</div>
                </div>
              )}

              {gamePhase === GAME_PHASES.ENDED && (
                <div 
                  className="winner-announcement"
                  style={{ 
                    color: players[0].score > players[1].score ? players[0].color.color : 
                           players[1].score > players[0].score ? players[1].color.color : '#ffffff',
                    borderColor: players[0].score > players[1].score ? players[0].color.color : 
                                players[1].score > players[0].score ? players[1].color.color : '#ffffff'
                  }}
                >
                  <div className="winner-text">
                    {players[0].score > players[1].score ? '🏆 ' + players[0].color.name.toUpperCase() + ' ПОБЕДИЛИ!' :
                     players[1].score > players[0].score ? '🏆 ' + players[1].color.name.toUpperCase() + ' ПОБЕДИЛИ!' :
                     '🤝 Ничья!'}
                  </div>
                </div>
              )}
            </div>

            <div className="panel">
              <h3 className="panel-title">Журнал Событий</h3>
              <div className="game-log">
                {log.map((entry, index) => (
                  <div key={entry.time} className="log-entry">
                    {entry.text}
                  </div>
                ))}
              </div>
            </div>

            <div className="panel controls">
              <button className="btn btn-secondary" onClick={() => setShowRules(true)}>
                <Info size={18} />
                Правила
              </button>
              <button className="btn btn-secondary" onClick={resetGame}>
                <RotateCcw size={18} />
                Новый Эксперимент
              </button>
            </div>
          </div>
        )}
      </div>

      {showRules && (
        <div className="rules-modal" onClick={() => setShowRules(false)}>
          <div className="rules-content" onClick={(e) => e.stopPropagation()}>
            <h3>🐛 Правила Игры "Клоподавка"</h3>
            
            <h4 style={{ color: '#00d4ff', marginTop: '20px', marginBottom: '10px' }}>Цель игры:</h4>
            <p>Заразить своим цветом наибольшую площадь игрового поля.</p>

            <h4 style={{ color: '#00d4ff', marginTop: '20px', marginBottom: '10px' }}>Подготовка:</h4>
            <ul>
              <li>Каждый игрок поочерёдно размещает стартового клопа на пустую клетку</li>
              <li>Игрок, разместивший клопа первым, ходит первым</li>
            </ul>

            <h4 style={{ color: '#00d4ff', marginTop: '20px', marginBottom: '10px' }}>Ход игрока (3 действия):</h4>
            <ul>
              <li><strong>Рождение:</strong> Разместить активного клопа (×) на пустую клетку, граничащую с вашими клопами</li>
              <li><strong>Атака:</strong> Заразить активного клопа противника, граничащего с вашими клопами</li>
            </ul>

            <h4 style={{ color: '#00d4ff', marginTop: '20px', marginBottom: '10px' }}>Типы клопов:</h4>
            <ul>
              <li><strong>Активный клоп (×):</strong> Может атаковать и служить источником для новых клопов</li>
              <li><strong>Заражённый клоп (закрашенный):</strong> Результат атаки, служит источником для новых клопов</li>
            </ul>

            <h4 style={{ color: '#00d4ff', marginTop: '20px', marginBottom: '10px' }}>Окружение:</h4>
            <p>Если после вашего хода активный клоп противника окружён со всех сторон вашими клопами, он автоматически заражается!</p>

            <h4 style={{ color: '#00d4ff', marginTop: '20px', marginBottom: '10px' }}>Конец игры:</h4>
            <p>Игра завершается, когда один из игроков больше не может выполнять действия (не осталось активных клопов или нет доступных ходов). Побеждает игрок с большим количеством контролируемых клеток.</p>

            <button 
              className="btn" 
              onClick={() => setShowRules(false)}
              style={{ marginTop: '20px', width: '100%' }}
            >
              Понятно!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
