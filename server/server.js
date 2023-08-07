// Import des dépendances
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDatabase from "./MongoDb.js";
import Boards from "./Models/BoardsModel.js";

// Création de l'application Express
dotenv.config();
connectDatabase();
const app = express();
app.use(cors());
app.use(express.json());

// Var
const PORT = process.env.PORT || 1000;

// API
app.get("/boards", async (req, res) => {
  try {
    const boards = await Boards.find();
    res.status(200).json(boards);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to fetch boards data from the database." });
  }
});
app.post("/boards", async (req, res) => {
  const data = req.body;
  try {
    // Save the data to MongoDB
    const boards = new Boards(data);
    await boards.save();

    res.status(201).json(boards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to save data to the database." });
  }
});
app.delete("/boards/:id", async (req, res) => {
  const boardId = req.params.id;
  try {
    // Find the board by ID and delete it
    const deletedBoard = await Boards.findByIdAndDelete(boardId);
    if (!deletedBoard) {
      return res.status(404).json({ message: "Board not found." });
    }
    res.status(200).json({ message: "Board deleted successfully." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to delete board from the database." });
  }
});
app.put("/boards/:id", async (req, res) => {
  const boardId = req.params.id;
  const updatedData = req.body;

  try {
    const board = await Boards.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Update the board's data
    board.name = updatedData.name;
    board.isActive = updatedData.isActive;
    board.columns = updatedData.columns; // Ensure to update the columns array
    await board.save();

    res.status(200).json(board);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update board data" });
  }
});
app.post("/boards/addTask/:boardId/:newColIndex", async (req, res) => {
  const { boardId, newColIndex } = req.params;
  const { title, status, description, checklists } = req.body;

  try {
    const board = await Boards.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const column = board.columns.find(
      (col, index) => index === Number(newColIndex)
    );
    if (!column) {
      return res.status(404).json({ message: "Target column not found." });
    }

    // Create the new task
    const task = {
      title,
      status,
      description,
      checklists,
    };

    column.tasks.push(task);

    await board.save();

    res.status(200).json(board);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add task to the board" });
  }
});
app.put(
  "/boards/editTask/:boardId/:prevColIndex/:newColIndex/:taskIndex",
  async (req, res) => {
    const { boardId, prevColIndex, newColIndex, taskIndex } = req.params;
    const { title, status, description, checklists } = req.body;

    try {
      const board = await Boards.findById(boardId);
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }

      const prevColumn = board.columns.find(
        (col, index) => index === Number(prevColIndex)
      );
      if (!prevColumn) {
        return res.status(404).json({ message: "Previous column not found." });
      }

      const task = prevColumn.tasks.find(
        (task, index) => index === Number(taskIndex)
      );
      if (!task) {
        return res
          .status(404)
          .json({ message: "Task not found in the previous column." });
      }

      const updatedBoard = { ...board.toObject() };

      updatedBoard.columns[prevColIndex].tasks.splice(taskIndex, 1);

      if (prevColIndex !== newColIndex) {
        updatedBoard.columns[newColIndex].tasks.push({
          ...task.toObject(),
          title,
          status,
          description,
          checklists,
        });
      } else {
        updatedBoard.columns[prevColIndex].tasks.splice(taskIndex, 0, {
          ...task.toObject(),
          title,
          status,
          description,
          checklists,
        });
      }

      await Boards.findByIdAndUpdate(boardId, updatedBoard, { new: true });

      res.status(200).json(updatedBoard);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to edit task on the board" });
    }
  }
);
app.delete(
  "/boards/deleteTask/:boardId/:colIndex/:taskIndex",
  async (req, res) => {
    const { boardId, colIndex, taskIndex } = req.params;

    try {
      const board = await Boards.findById(boardId);
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }

      const column = board.columns.find(
        (col, index) => index === Number(colIndex)
      );
      if (!column) {
        return res.status(404).json({ message: "Column not found." });
      }

      if (taskIndex >= column.tasks.length) {
        return res
          .status(404)
          .json({ message: "Task not found in the column." });
      }

      // Remove the task from the column's tasks array
      column.tasks.splice(taskIndex, 1);

      // Save the updated board to the database
      await board.save();

      res.status(200).json(board);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to delete task from the board" });
    }
  }
);
app.put("/boards/dragTask/:boardId", async (req, res) => {
  const { boardId } = req.params;
  const { colIndex, prevColIndex, taskIndex } = req.body;

  try {
    const board = await Boards.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const prevColumn = board.columns.find(
      (col, index) => index === Number(prevColIndex)
    );
    if (!prevColumn) {
      return res.status(404).json({ message: "Previous column not found." });
    }

    const task = prevColumn.tasks.find(
      (task, index) => index === Number(taskIndex)
    );
    if (!task) {
      return res
        .status(404)
        .json({ message: "Task not found in the previous column." });
    }

    const updatedBoard = { ...board.toObject() };

    updatedBoard.columns[prevColIndex].tasks.splice(taskIndex, 1);

    updatedBoard.columns[colIndex].tasks.push(task);

    await Boards.findByIdAndUpdate(boardId, updatedBoard, { new: true });

    res.status(200).json(updatedBoard);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to drag task on the board" });
  }
});
app.put(
  "/boards/setChecklistCompleted/:boardId/:colIndex/:taskIndex/:checklistIndex",
  async (req, res) => {
    const { boardId, colIndex, taskIndex, checklistIndex } = req.params;

    try {
      const board = await Boards.findById(boardId);
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }

      const col = board.columns.find((col, i) => i === Number(colIndex));
      if (!col) {
        return res.status(404).json({ message: "Column not found" });
      }

      const task = col.tasks.find((task, i) => i === Number(taskIndex));
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const checklist = task.checklists.find(
        (checklist, i) => i === Number(checklistIndex)
      );
      if (!checklist) {
        return res.status(404).json({ message: "Checklist not found" });
      }

      checklist.isCompleted = !checklist.isCompleted;

      await board.save();

      res.status(200).json(board);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Failed to set checklist completed on the board" });
    }
  }
);

// Démarrage du serveur
app.listen(PORT, console.log(`server run in port ${PORT}`));
