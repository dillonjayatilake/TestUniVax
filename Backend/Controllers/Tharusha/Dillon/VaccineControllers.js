const VaccineProduct = require('../../Model/Dillon/VaccineModel');
const DoseRequirement = require('../../Model/Dillon/DoseModel');

// @desc    CREATE a new vaccine
// @route   POST /api/vaccines
exports.createVaccine = async (req, res) => {
  try {
    // Check if vaccine with same CVX code exists
    const existingVaccine = await VaccineProduct.findOne({ 
      cvxCode: req.body.cvxCode 
    });
    
    if (existingVaccine) {
      return res.status(400).json({
        success: false,
        error: 'Vaccine with this CVX code already exists'
      });
    }

    const vaccine = await VaccineProduct.create({
      ...req.body,
      createdBy: req.user?.id || 'system',
      version: 1
    });

    res.status(201).json({
      success: true,
      data: vaccine,
      message: 'Vaccine created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    READ all vaccines (with filtering)
// @route   GET /api/vaccines
exports.getAllVaccines = async (req, res) => {
  try {
    const { status, manufacturer, search, region } = req.query;
    const query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by manufacturer
    if (manufacturer) {
      query.manufacturer = manufacturer;
    }

    // Search by name or generic name
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by approved region
    if (region) {
      query['approvedRegions.country'] = region;
    }

    const vaccines = await VaccineProduct.find(query)
      .populate({
        path: 'doseRequirements',
        match: { status: 'active' },
        select: 'doseNumber minAge intervalFromPrevious'
      })
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: vaccines.length,
      data: vaccines
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    READ single vaccine by ID
// @route   GET /api/vaccines/:id
exports.getVaccineById = async (req, res) => {
  try {
    const vaccine = await VaccineProduct.findById(req.params.id)
      .populate('doseRequirements');

    if (!vaccine) {
      return res.status(404).json({
        success: false,
        error: 'Vaccine not found'
      });
    }

    res.status(200).json({
      success: true,
      data: vaccine
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    UPDATE a vaccine (with versioning)
// @route   PUT /api/vaccines/:id
exports.updateVaccine = async (req, res) => {
  try {
    const oldVaccine = await VaccineProduct.findById(req.params.id);
    
    if (!oldVaccine) {
      return res.status(404).json({
        success: false,
        error: 'Vaccine not found'
      });
    }

    // If status change or major update, create new version
    if (req.body.status !== oldVaccine.status || 
        req.body.totalDoses !== oldVaccine.totalDoses) {
      
      // Archive old version
      await VaccineProduct.findByIdAndUpdate(req.params.id, {
        status: 'archived',
        validUntil: new Date()
      });

      // Create new version
      const newVaccine = await VaccineProduct.create({
        ...oldVaccine.toObject(),
        ...req.body,
        _id: undefined,
        version: oldVaccine.version + 1,
        validFrom: new Date(),
        validUntil: null,
        status: req.body.status || 'active',
        lastModifiedBy: req.user?.id || 'system',
        updateReason: req.body.updateReason || 'Manual update'
      });

      return res.status(200).json({
        success: true,
        data: newVaccine,
        message: 'Vaccine updated with new version',
        previousVersion: oldVaccine.version
      });
    }

    // Minor update (no version change)
    const vaccine = await VaccineProduct.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        lastModifiedBy: req.user?.id || 'system'
      },
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: vaccine,
      message: 'Vaccine updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    DELETE (soft delete) a vaccine
// @route   DELETE /api/vaccines/:id
exports.deleteVaccine = async (req, res) => {
  try {
    const vaccine = await VaccineProduct.findById(req.params.id);

    if (!vaccine) {
      return res.status(404).json({
        success: false,
        error: 'Vaccine not found'
      });
    }

    // Check if vaccine has associated dose requirements
    const doseCount = await DoseRequirement.countDocuments({ 
      vaccineId: req.params.id,
      status: 'active'
    });

    if (doseCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete vaccine with active dose requirements. Archive doses first.'
      });
    }

    // Soft delete
    vaccine.status = 'discontinued';
    vaccine.validUntil = new Date();
    vaccine.discontinuedReason = req.body.reason || 'Manual discontinuation';
    await vaccine.save();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Vaccine discontinued successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    GET vaccine history/versions
// @route   GET /api/vaccines/:id/history
exports.getVaccineHistory = async (req, res) => {
  try {
    const vaccine = await VaccineProduct.findById(req.params.id);
    
    if (!vaccine) {
      return res.status(404).json({
        success: false,
        error: 'Vaccine not found'
      });
    }

    // Find all versions by name or CVX code
    const history = await VaccineProduct.find({
      $or: [
        { name: vaccine.name },
        { cvxCode: vaccine.cvxCode }
      ]
    })
    .sort({ version: -1 })
    .select('name version status validFrom validUntil updateReason');

    res.status(200).json({
      success: true,
      currentVersion: vaccine.version,
      history: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    CREATE dose requirement for a vaccine
// @route   POST /api/vaccines/:vaccineId/doses
exports.createDose = async (req, res) => {
  try {
    const vaccine = await VaccineProduct.findById(req.params.vaccineId);
    
    if (!vaccine) {
      return res.status(404).json({
        success: false,
        error: 'Vaccine not found'
      });
    }

    // Check if dose number already exists
    const existingDose = await DoseRequirement.findOne({
      vaccineId: req.params.vaccineId,
      doseNumber: req.body.doseNumber,
      status: 'active'
    });

    if (existingDose) {
      return res.status(400).json({
        success: false,
        error: `Dose ${req.body.doseNumber} already exists for this vaccine`
      });
    }

    const dose = await DoseRequirement.create({
      ...req.body,
      vaccineId: req.params.vaccineId,
      version: 1
    });

    res.status(201).json({
      success: true,
      data: dose,
      message: 'Dose requirement created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    GET all doses for a vaccine
// @route   GET /api/vaccines/:vaccineId/doses
exports.getVaccineDoses = async (req, res) => {
  try {
    const doses = await DoseRequirement.find({
      vaccineId: req.params.vaccineId,
      status: { $ne: 'superseded' }
    }).sort({ doseNumber: 1 });

    res.status(200).json({
      success: true,
      count: doses.length,
      data: doses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    UPDATE a dose requirement
// @route   PUT /api/doses/:id
exports.updateDose = async (req, res) => {
  try {
    const oldDose = await DoseRequirement.findById(req.params.id);
    
    if (!oldDose) {
      return res.status(404).json({
        success: false,
        error: 'Dose requirement not found'
      });
    }

    // If significant change, create new version
    if (req.body.minAge || req.body.intervalFromPrevious) {
      // Mark old version as superseded
      await DoseRequirement.findByIdAndUpdate(req.params.id, {
        status: 'superseded',
        validUntil: new Date()
      });

      // Create new version
      const newDose = await DoseRequirement.create({
        ...oldDose.toObject(),
        ...req.body,
        _id: undefined,
        version: oldDose.version + 1,
        validFrom: new Date(),
        validUntil: null,
        status: 'active'
      });

      return res.status(200).json({
        success: true,
        data: newDose,
        message: 'Dose requirement updated with new version'
      });
    }

    // Minor update
    const dose = await DoseRequirement.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: dose,
      message: 'Dose requirement updated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    DELETE a dose requirement
// @route   DELETE /api/doses/:id
exports.deleteDose = async (req, res) => {
  try {
    const dose = await DoseRequirement.findById(req.params.id);

    if (!dose) {
      return res.status(404).json({
        success: false,
        error: 'Dose requirement not found'
      });
    }

    // Soft delete
    dose.status = 'superseded';
    dose.validUntil = new Date();
    await dose.save();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Dose requirement deleted (soft delete)'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Calculate next due date based on patient age
// @route   POST /api/doses/calculate
exports.calculateDueDate = async (req, res) => {
  try {
    const { vaccineId, patientAgeMonths, lastDoseDate, doseNumber } = req.body;

    const dose = await DoseRequirement.findOne({
      vaccineId,
      doseNumber: doseNumber || 1,
      status: 'active'
    });

    if (!dose) {
      return res.status(404).json({
        success: false,
        error: 'Dose requirements not found'
      });
    }

    let dueDate = null;
    let status = 'eligible';

    // First dose - based on age
    if (doseNumber === 1 || !lastDoseDate) {
      if (patientAgeMonths >= dose.minAge.value) {
        dueDate = new Date();
      } else {
        // Calculate future date when age requirement will be met
        const birthDate = new Date();
        birthDate.setMonth(birthDate.getMonth() - patientAgeMonths);
        dueDate = new Date(birthDate);
        dueDate.setMonth(dueDate.getMonth() + dose.minAge.value);
        status = 'future';
      }
    } 
    // Subsequent doses - based on interval
    else if (lastDoseDate) {
      const lastDose = new Date(lastDoseDate);
      dueDate = new Date(lastDose);
      
      if (dose.intervalFromPrevious.exactDays) {
        dueDate.setDate(dueDate.getDate() + dose.intervalFromPrevious.exactDays);
      } else if (dose.intervalFromPrevious.minDays) {
        dueDate.setDate(dueDate.getDate() + dose.intervalFromPrevious.minDays);
      }

      // Check if overdue
      if (new Date() > dueDate) {
        status = 'overdue';
      }
    }

    res.status(200).json({
      success: true,
      data: {
        dueDate,
        status,
        doseNumber: dose.doseNumber,
        minAgeRequired: dose.minAge,
        interval: dose.intervalFromPrevious
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};