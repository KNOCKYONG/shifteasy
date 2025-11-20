class SolverFailure(RuntimeError):
  def __init__(self, message: str, diagnostics=None):
    super().__init__(message)
    self.diagnostics = diagnostics
